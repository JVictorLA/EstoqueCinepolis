const { pool } = require("../database/connection");
const estoqueService = require("./estoqueService");
const inventarioService = require("./inventarioService");

function normalizeOptionalEstoqueId(value) {
  if (value === undefined || value === null || value === "" || value === "all") return null;
  const id = Number(value);
  if (!id) {
    throw Object.assign(new Error("Estoque inválido"), { status: 400 });
  }
  return id;
}

function itemStatus(diferenca) {
  if (diferenca === 0) return "ok";
  return diferenca > 0 ? "sobra" : "falta";
}

function mapConference(row) {
  return {
    id: row.id,
    estoque_id: row.estoque_id,
    estoque_nome: row.estoque_nome || (row.estoque_id ? null : "Todos os estoques"),
    usuario_id: row.usuario_id,
    usuario_nome: row.usuario_nome,
    status: row.status,
    observacao: row.observacao,
    criado_em: row.criado_em,
    atualizado_em: row.atualizado_em,
    finalizado_em: row.finalizado_em,
    itens_count: Number(row.itens_count || 0),
    divergencias_count: Number(row.divergencias_count || 0),
  };
}

function mapItem(row) {
  return {
    id: row.id,
    conferencia_id: row.conferencia_id,
    estoque_id: row.estoque_id,
    estoque_nome: row.estoque_nome,
    produto_id: row.produto_id,
    codigo_barras: row.codigo_barras,
    produto_nome: row.produto_nome,
    quantidade_sistema: Number(row.quantidade_sistema),
    quantidade_contada: Number(row.quantidade_contada),
    diferenca: Number(row.diferenca),
    status: row.status,
    criado_em: row.criado_em,
    atualizado_em: row.atualizado_em,
  };
}

async function assertEditable(conferenciaId, conn = pool) {
  const [rows] = await conn.query(
    "SELECT id, status, estoque_id FROM conferencias_estoque WHERE id = ? LIMIT 1",
    [conferenciaId],
  );
  const conference = rows[0];
  if (!conference) {
    throw Object.assign(new Error("Conferência não encontrada"), { status: 404 });
  }
  if (conference.status === "finalizada") {
    throw Object.assign(new Error("Conferência finalizada não pode ser editada"), { status: 409 });
  }
  return conference;
}

async function validateEstoque(estoqueId) {
  if (estoqueId === null) return;
  const estoque = await estoqueService.findById(estoqueId);
  if (!estoque) {
    throw Object.assign(new Error("Estoque não encontrado"), { status: 404 });
  }
  if (estoque.arquivado) {
    throw Object.assign(new Error("Estoque arquivado"), { status: 400 });
  }
}

async function listar() {
  const [rows] = await pool.query(
    `SELECT
       c.*,
       e.nome AS estoque_nome,
       COALESCE(stats.itens_count, 0) AS itens_count,
       COALESCE(stats.divergencias_count, 0) AS divergencias_count
     FROM conferencias_estoque c
     LEFT JOIN estoques e ON e.id = c.estoque_id
     LEFT JOIN (
       SELECT
         conferencia_id,
         COUNT(*) AS itens_count,
         SUM(CASE WHEN status <> 'ok' THEN 1 ELSE 0 END) AS divergencias_count
       FROM conferencia_estoque_itens
       GROUP BY conferencia_id
     ) stats ON stats.conferencia_id = c.id
     ORDER BY c.atualizado_em DESC, c.criado_em DESC`,
  );
  return rows.map(mapConference);
}

async function buscarCompleta(id) {
  const [headers] = await pool.query(
    `SELECT c.*, e.nome AS estoque_nome
     FROM conferencias_estoque c
     LEFT JOIN estoques e ON e.id = c.estoque_id
     WHERE c.id = ?
     LIMIT 1`,
    [id],
  );

  if (!headers.length) {
    throw Object.assign(new Error("Conferência não encontrada"), { status: 404 });
  }

  const [items] = await pool.query(
    `SELECT i.*, e.nome AS estoque_nome
     FROM conferencia_estoque_itens i
     LEFT JOIN estoques e ON e.id = i.estoque_id
     WHERE i.conferencia_id = ?
     ORDER BY i.atualizado_em DESC, i.criado_em DESC`,
    [id],
  );

  return {
    ...mapConference(headers[0]),
    itens: items.map(mapItem),
  };
}

async function criar({ estoque_id, usuario, observacao }) {
  const estoqueId = normalizeOptionalEstoqueId(estoque_id);
  await validateEstoque(estoqueId);

  const [result] = await pool.query(
    `INSERT INTO conferencias_estoque
       (estoque_id, usuario_id, usuario_nome, status, observacao, criado_em, atualizado_em)
     VALUES (?, ?, ?, 'aberta', ?, NOW(), NOW())`,
    [estoqueId, usuario?.id || null, usuario?.nome || null, observacao || null],
  );

  return buscarCompleta(result.insertId);
}

async function atualizar(id, { estoque_id, observacao, usuario_nome }) {
  await assertEditable(id);
  const estoqueId = estoque_id === undefined ? undefined : normalizeOptionalEstoqueId(estoque_id);
  if (estoqueId !== undefined) await validateEstoque(estoqueId);

  const fields = ["atualizado_em = NOW()"];
  const values = [];

  if (estoqueId !== undefined) {
    fields.push("estoque_id = ?");
    values.push(estoqueId);
  }
  if (observacao !== undefined) {
    fields.push("observacao = ?");
    values.push(observacao || null);
  }
  if (usuario_nome !== undefined) {
    fields.push("usuario_nome = ?");
    values.push(usuario_nome || null);
  }

  values.push(id);
  await pool.query(`UPDATE conferencias_estoque SET ${fields.join(", ")} WHERE id = ?`, values);
  return buscarCompleta(id);
}

async function findStockProductByBarcode(codigoBarras, estoqueId) {
  const params = [codigoBarras];
  let estoqueFilter = "";

  if (estoqueId) {
    estoqueFilter = "AND ep.estoque_id = ?";
    params.push(estoqueId);
  }

  const [rows] = await pool.query(
    `SELECT
       p.id AS produto_id,
       p.codigo_barras,
       p.nome AS produto_nome,
       ep.estoque_id,
       e.nome AS estoque_nome,
       COALESCE(lotes.quantidade_sistema, ep.estoque_atual, 0) AS quantidade_sistema
     FROM produtos p
     INNER JOIN estoque_produtos ep ON ep.produto_id = p.id
     INNER JOIN estoques e ON e.id = ep.estoque_id AND COALESCE(e.arquivado, 0) = 0
     LEFT JOIN (
       SELECT estoque_produto_id, COALESCE(SUM(quantidade), 0) AS quantidade_sistema
       FROM produto_lotes
       GROUP BY estoque_produto_id
     ) lotes ON lotes.estoque_produto_id = ep.id
     WHERE p.codigo_barras = ? AND p.ativo = 1 ${estoqueFilter}
     ORDER BY e.nome ASC`,
    params,
  );

  return rows;
}

async function salvarItem(conferenciaId, data) {
  const quantidadeContada = Number(data.quantidade_contada);
  if (!Number.isFinite(quantidadeContada) || quantidadeContada < 0) {
    throw Object.assign(new Error("Quantidade contada inválida"), { status: 400 });
  }

  const conference = await assertEditable(conferenciaId);
  const conferenceEstoqueId = normalizeOptionalEstoqueId(conference.estoque_id);
  const requestedEstoqueId = data.estoque_id ? Number(data.estoque_id) : conferenceEstoqueId;

  if (!data.codigo_barras) {
    throw Object.assign(new Error("Código de barras obrigatório"), { status: 400 });
  }

  const matches = await findStockProductByBarcode(String(data.codigo_barras).trim(), requestedEstoqueId);
  if (!matches.length) {
    throw Object.assign(new Error("Produto não encontrado no estoque informado"), { status: 404 });
  }

  if (!requestedEstoqueId && matches.length > 1) {
    const err = Object.assign(new Error("Produto encontrado em mais de um estoque"), {
      status: 409,
      options: matches.map((row) => ({
        estoque_id: row.estoque_id,
        estoque_nome: row.estoque_nome,
        quantidade_sistema: Number(row.quantidade_sistema),
      })),
    });
    throw err;
  }

  const product = matches[0];
  const quantidadeSistema = Number(product.quantidade_sistema);
  const diferenca = quantidadeContada - quantidadeSistema;
  const status = itemStatus(diferenca);

  const [existing] = await pool.query(
    `SELECT id
     FROM conferencia_estoque_itens
     WHERE conferencia_id = ? AND estoque_id = ? AND produto_id = ?
     LIMIT 1`,
    [conferenciaId, product.estoque_id, product.produto_id],
  );

  if (existing.length) {
    await pool.query(
      `UPDATE conferencia_estoque_itens
       SET codigo_barras = ?,
           produto_nome = ?,
           quantidade_sistema = ?,
           quantidade_contada = ?,
           diferenca = ?,
           status = ?,
           atualizado_em = NOW()
       WHERE id = ?`,
      [
        product.codigo_barras,
        product.produto_nome,
        quantidadeSistema,
        quantidadeContada,
        diferenca,
        status,
        existing[0].id,
      ],
    );
  } else {
    await pool.query(
      `INSERT INTO conferencia_estoque_itens
         (conferencia_id, estoque_id, produto_id, codigo_barras, produto_nome,
          quantidade_sistema, quantidade_contada, diferenca, status, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        conferenciaId,
        product.estoque_id,
        product.produto_id,
        product.codigo_barras,
        product.produto_nome,
        quantidadeSistema,
        quantidadeContada,
        diferenca,
        status,
      ],
    );
  }

  await pool.query("UPDATE conferencias_estoque SET atualizado_em = NOW() WHERE id = ?", [
    conferenciaId,
  ]);

  return buscarCompleta(conferenciaId);
}

async function removerItem(conferenciaId, itemId) {
  await assertEditable(conferenciaId);
  const [result] = await pool.query(
    "DELETE FROM conferencia_estoque_itens WHERE id = ? AND conferencia_id = ?",
    [itemId, conferenciaId],
  );

  if (!result.affectedRows) {
    throw Object.assign(new Error("Item não encontrado"), { status: 404 });
  }

  await pool.query("UPDATE conferencias_estoque SET atualizado_em = NOW() WHERE id = ?", [
    conferenciaId,
  ]);
}

async function remover(id) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      "SELECT id, status FROM conferencias_estoque WHERE id = ? LIMIT 1 FOR UPDATE",
      [id],
    );
    const conference = rows[0];
    if (!conference) {
      throw Object.assign(new Error("Conferência não encontrada"), { status: 404 });
    }
    if (conference.status === "finalizada") {
      throw Object.assign(new Error("Conferência finalizada não pode ser excluída"), {
        status: 409,
      });
    }

    await conn.query("DELETE FROM conferencia_estoque_itens WHERE conferencia_id = ?", [id]);
    await conn.query("DELETE FROM conferencias_estoque WHERE id = ?", [id]);

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function finalizar(id) {
  await assertEditable(id);
  await pool.query(
    `UPDATE conferencias_estoque
     SET status = 'finalizada', finalizado_em = NOW(), atualizado_em = NOW()
     WHERE id = ?`,
    [id],
  );
  return buscarCompleta(id);
}

async function buscarProdutoPorCodigo(codigoBarras, estoqueId) {
  const resolvedEstoqueId = inventarioService.isAllStocks(estoqueId)
    ? null
    : normalizeOptionalEstoqueId(estoqueId);
  const rows = await findStockProductByBarcode(codigoBarras, resolvedEstoqueId);
  return rows.map((row) => ({
    produto_id: row.produto_id,
    codigo_barras: row.codigo_barras,
    produto_nome: row.produto_nome,
    estoque_id: row.estoque_id,
    estoque_nome: row.estoque_nome,
    quantidade_sistema: Number(row.quantidade_sistema),
  }));
}

module.exports = {
  listar,
  buscarCompleta,
  criar,
  atualizar,
  salvarItem,
  removerItem,
  remover,
  finalizar,
  buscarProdutoPorCodigo,
};
