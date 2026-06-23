const { pool } = require("../database/connection");
const DEFAULT_LOT_CODE = "__SEM_LOTE__";

function normalizeDateOnly(data_validade) {
  if (data_validade === undefined) return undefined;
  if (data_validade === null || data_validade === "") return null;

  const value = String(data_validade).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw Object.assign(new Error("data_validade inválida"), { status: 400 });
  }

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw Object.assign(new Error("data_validade inválida"), { status: 400 });
  }

  return value;
}

async function categoryRequiresValidity(categoriaId, conn = pool) {
  const [rows] = await conn.query(
    "SELECT COALESCE(exige_validade, 0) AS exige_validade FROM categorias WHERE id = ? LIMIT 1",
    [categoriaId],
  );
  if (!rows.length) {
    throw Object.assign(new Error("Categoria não encontrada"), { status: 404 });
  }
  return !!rows[0].exige_validade;
}

async function resolveLotValidity(categoriaId, dataValidade, conn = pool) {
  const requires = await categoryRequiresValidity(categoriaId, conn);
  const normalized = normalizeDateOnly(dataValidade);
  if (requires && !normalized) {
    throw Object.assign(new Error("Data de validade obrigatória para esta categoria"), {
      status: 400,
    });
  }
  return requires ? normalized : null;
}

function normalizeLotCode(lote) {
  const value = String(lote || "").trim();
  if (!value) {
    throw Object.assign(new Error("lote é obrigatório"), { status: 400 });
  }
  return value;
}

function displayLotCode(lote) {
  return lote === DEFAULT_LOT_CODE ? "Sem lote" : lote;
}

async function normalizeLotForCategory(categoriaId, lote, conn = pool) {
  const requires = await categoryRequiresValidity(categoriaId, conn);
  if (requires) return normalizeLotCode(lote);
  const value = String(lote || "").trim();
  if (!value || value.toLowerCase() === "sem lote") return DEFAULT_LOT_CODE;
  return value;
}

async function getStockProduct(conn, produtoId, estoqueId, lock = false) {
  const [rows] = await conn.query(
    `SELECT
       ep.id AS estoque_produto_id,
       ep.estoque_id,
       ep.produto_id,
       ep.estoque_minimo,
       COALESCE(ep.estoque_atual, 0) AS estoque_atual,
       p.nome AS produto_nome,
       p.preco_venda,
       p.categoria_id,
       p.ativo,
       e.nome AS estoque_nome,
       e.ativo AS estoque_ativo,
       COALESCE(e.arquivado, 0) AS estoque_arquivado
     FROM estoque_produtos ep
     INNER JOIN produtos p ON p.id = ep.produto_id
     INNER JOIN estoques e ON e.id = ep.estoque_id
     WHERE ep.produto_id = ? AND ep.estoque_id = ?
     LIMIT 1 ${lock ? "FOR UPDATE" : ""}`,
    [produtoId, estoqueId],
  );
  return rows[0] || null;
}

async function ensureStockProduct(conn, produtoId, estoqueId) {
  let row = await getStockProduct(conn, produtoId, estoqueId, true);
  if (row) return row;

  const [stocks] = await conn.query(
    "SELECT id FROM estoques WHERE id = ? AND ativo = 1 AND COALESCE(arquivado, 0) = 0 LIMIT 1",
    [estoqueId],
  );
  if (!stocks.length) {
    throw Object.assign(new Error("Estoque inativo ou arquivado"), { status: 400 });
  }

  await conn.query(
    `INSERT INTO estoque_produtos
       (estoque_id, produto_id, estoque_atual, estoque_minimo, criado_em)
     VALUES (?, ?, 0, 0, NOW())`,
    [estoqueId, produtoId],
  );

  row = await getStockProduct(conn, produtoId, estoqueId, true);
  return row;
}

async function recalcStockProduct(conn, estoqueProdutoId) {
  const [[sumRow]] = await conn.query(
    "SELECT COALESCE(SUM(quantidade), 0) AS total FROM produto_lotes WHERE estoque_produto_id = ?",
    [estoqueProdutoId],
  );
  const total = Number(sumRow?.total || 0);
  await conn.query(
    "UPDATE estoque_produtos SET estoque_atual = ? WHERE id = ?",
    [total, estoqueProdutoId],
  );
  return total;
}

async function ensureDefaultLotFromCache(conn, stockProduct) {
  const requires = await categoryRequiresValidity(stockProduct.categoria_id, conn);
  if (requires) return null;

  const [existing] = await conn.query(
    "SELECT id FROM produto_lotes WHERE estoque_produto_id = ? LIMIT 1",
    [stockProduct.estoque_produto_id],
  );
  if (existing.length) return null;

  const cachedQuantity = Number(stockProduct.estoque_atual || 0);
  if (cachedQuantity <= 0) return null;

  const [result] = await conn.query(
    `INSERT INTO produto_lotes
       (estoque_produto_id, lote, data_validade, quantidade, criado_em, atualizado_em)
     VALUES (?, ?, NULL, ?, NOW(), NOW())`,
    [stockProduct.estoque_produto_id, DEFAULT_LOT_CODE, cachedQuantity],
  );
  return {
    id: result.insertId,
    estoque_produto_id: stockProduct.estoque_produto_id,
    lote: DEFAULT_LOT_CODE,
    data_validade: null,
    quantidade: cachedQuantity,
  };
}

async function listByProductStock(produtoId, estoqueId) {
  const params = [produtoId];
  const stockFilter = estoqueId && estoqueId !== "all" ? "AND ep.estoque_id = ?" : "";
  if (stockFilter) params.push(Number(estoqueId));

  const [rows] = await pool.query(
    `SELECT
       pl.id,
       pl.estoque_produto_id,
       ep.produto_id,
       ep.estoque_id,
       e.nome AS estoque_nome,
       CASE WHEN pl.lote = ? THEN 'Sem lote' ELSE pl.lote END AS lote,
       pl.data_validade,
       COALESCE(pl.quantidade, 0) AS quantidade,
       pl.criado_em,
       pl.atualizado_em
     FROM produto_lotes pl
     INNER JOIN estoque_produtos ep ON ep.id = pl.estoque_produto_id
     INNER JOIN estoques e ON e.id = ep.estoque_id
     WHERE ep.produto_id = ? ${stockFilter}
     ORDER BY
       CASE WHEN pl.data_validade IS NULL THEN 1 ELSE 0 END,
       pl.data_validade ASC,
       pl.lote ASC`,
    [DEFAULT_LOT_CODE, ...params],
  );
  return rows;
}

async function findLotMatches(conn, estoqueProdutoId, loteBusca, lock = false) {
  const lote = String(loteBusca || "").trim() || DEFAULT_LOT_CODE;
  const [rows] = await conn.query(
    `SELECT *
     FROM produto_lotes
     WHERE estoque_produto_id = ?
       AND (lote = ? OR lote LIKE ?)
     ORDER BY
       CASE WHEN data_validade IS NULL THEN 1 ELSE 0 END,
       data_validade ASC,
       lote ASC
     ${lock ? "FOR UPDATE" : ""}`,
    [estoqueProdutoId, lote, `%${lote}`],
  );
  return rows;
}

async function resolveLot(conn, estoqueProdutoId, loteBusca, lock = false) {
  const rows = await findLotMatches(conn, estoqueProdutoId, loteBusca, lock);
  if (!rows.length) {
    throw Object.assign(new Error("Lote não encontrado neste estoque"), { status: 404 });
  }
  if (rows.length > 1) {
    throw Object.assign(new Error("Mais de um lote encontrado para esse final"), {
      status: 409,
      options: rows.map((row) => ({
        id: row.id,
        lote: row.lote,
        data_validade: row.data_validade,
        quantidade: Number(row.quantidade),
      })),
    });
  }
  return rows[0];
}

async function resolveLotForStockProduct(conn, stockProduct, loteBusca, lock = false) {
  const lote = await normalizeLotForCategory(stockProduct.categoria_id, loteBusca, conn);
  return resolveLot(conn, stockProduct.estoque_produto_id, lote, lock);
}

async function upsertLot(conn, estoqueProdutoId, { lote, data_validade, quantidade, categoria_id }) {
  const lotCode = categoria_id
    ? await normalizeLotForCategory(categoria_id, lote, conn)
    : normalizeLotCode(lote);
  const qtd = Number(quantidade);
  if (!Number.isFinite(qtd) || qtd < 0) {
    throw Object.assign(new Error("quantidade inválida"), { status: 400 });
  }

  const [rows] = await conn.query(
    `SELECT *
     FROM produto_lotes
     WHERE estoque_produto_id = ? AND lote = ?
     LIMIT 1
     FOR UPDATE`,
    [estoqueProdutoId, lotCode],
  );

  if (rows.length) {
    const updatedQuantity = Number(rows[0].quantidade) + qtd;
    await conn.query(
      `UPDATE produto_lotes
       SET quantidade = ?, data_validade = COALESCE(?, data_validade), atualizado_em = NOW()
       WHERE id = ?`,
      [updatedQuantity, data_validade, rows[0].id],
    );
    return { ...rows[0], quantidade: updatedQuantity, data_validade: data_validade ?? rows[0].data_validade };
  }

  const [result] = await conn.query(
    `INSERT INTO produto_lotes
       (estoque_produto_id, lote, data_validade, quantidade, criado_em, atualizado_em)
     VALUES (?, ?, ?, ?, NOW(), NOW())`,
    [estoqueProdutoId, lotCode, data_validade || null, qtd],
  );

  return {
    id: result.insertId,
    estoque_produto_id: estoqueProdutoId,
    lote: lotCode,
    data_validade: data_validade || null,
    quantidade: qtd,
  };
}

async function getFefoWarning(conn, estoqueProdutoId, selectedLot) {
  if (!selectedLot.data_validade) return null;
  const [rows] = await conn.query(
    `SELECT id, lote, data_validade, quantidade
     FROM produto_lotes
     WHERE estoque_produto_id = ?
       AND id <> ?
       AND quantidade > 0
       AND data_validade IS NOT NULL
       AND data_validade < ?
     ORDER BY data_validade ASC, lote ASC
     LIMIT 1`,
    [estoqueProdutoId, selectedLot.id, selectedLot.data_validade],
  );
  if (!rows.length) return null;
  const older = rows[0];
  return {
    lote_id: older.id,
    lote: displayLotCode(older.lote),
    data_validade: older.data_validade,
    quantidade: Number(older.quantidade),
    mensagem: `Existe um lote que vence antes deste. Recomenda-se retirar primeiro o lote ${displayLotCode(older.lote)}, validade ${String(older.data_validade).slice(0, 10)}, quantidade ${Number(older.quantidade)}.`,
  };
}

async function insertMovementLot(
  conn,
  { movimentacaoId, loteId, quantidade, ignorouFefo = false, justificativaFefo = null },
) {
  await conn.query(
    `INSERT INTO movimentacao_lotes
       (movimentacao_id, lote_id, quantidade, ignorou_fefo, justificativa_fefo, criado_em)
     VALUES (?, ?, ?, ?, ?, NOW())`,
    [
      movimentacaoId,
      loteId,
      quantidade,
      ignorouFefo ? 1 : 0,
      justificativaFefo || null,
    ],
  );
}

module.exports = {
  normalizeDateOnly,
  normalizeLotCode,
  DEFAULT_LOT_CODE,
  displayLotCode,
  normalizeLotForCategory,
  resolveLotValidity,
  getStockProduct,
  ensureStockProduct,
  recalcStockProduct,
  ensureDefaultLotFromCache,
  listByProductStock,
  findLotMatches,
  resolveLot,
  resolveLotForStockProduct,
  upsertLot,
  getFefoWarning,
  insertMovementLot,
};
