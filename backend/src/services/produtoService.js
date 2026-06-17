const { pool } = require("../database/connection");
const estoqueService = require("./estoqueService");
const loteService = require("./loteService");

const SELECT_SPECIFIC_STOCK = `
  SELECT
    p.id,
    p.codigo_barras,
    p.nome,
    p.categoria_id,
    c.nome AS categoria_nome,
    COALESCE(c.exige_validade, 0) AS exige_validade,
    p.unidade,
    p.preco_venda,
    ep.estoque_id,
    e.nome AS estoque_nome,
    COALESCE(lotes.data_validade, ep.data_validade) AS data_validade,
    COALESCE(lotes.estoque_atual, ep.estoque_atual, 0) AS estoque_atual,
    COALESCE(ep.estoque_minimo, 0) AS estoque_minimo,
    p.ativo,
    p.criado_em,
    p.atualizado_em,
    (
      SELECT COUNT(*)
      FROM movimentacoes m
      WHERE m.produto_id = p.id
    ) AS movimentacoes_count,
    CASE
      WHEN COALESCE(lotes.estoque_atual, ep.estoque_atual, 0) <= 0 THEN 1 ELSE 0
    END AS sem_estoque,
    CASE
      WHEN COALESCE(ep.estoque_minimo, 0) > 0
       AND COALESCE(lotes.estoque_atual, ep.estoque_atual, 0) <= COALESCE(ep.estoque_minimo, 0)
      THEN 1 ELSE 0
    END AS estoque_baixo
  FROM produtos p
  LEFT JOIN categorias c ON c.id = p.categoria_id
  INNER JOIN estoque_produtos ep ON ep.produto_id = p.id AND ep.estoque_id = ?
  INNER JOIN estoques e ON e.id = ep.estoque_id
  LEFT JOIN (
    SELECT estoque_produto_id,
      COALESCE(SUM(quantidade), 0) AS estoque_atual,
      MIN(CASE WHEN quantidade > 0 THEN data_validade ELSE NULL END) AS data_validade
    FROM produto_lotes
    GROUP BY estoque_produto_id
  ) lotes ON lotes.estoque_produto_id = ep.id
`;

const SELECT_ALL_STOCKS = `
  SELECT
    p.id,
    p.codigo_barras,
    p.nome,
    p.categoria_id,
    c.nome AS categoria_nome,
    COALESCE(c.exige_validade, 0) AS exige_validade,
    p.unidade,
    p.preco_venda,
    NULL AS estoque_id,
    'Todos os estoques' AS estoque_nome,
    MIN(COALESCE(lotes.data_validade, ep.data_validade)) AS data_validade,
    COALESCE(SUM(COALESCE(lotes.estoque_atual, ep.estoque_atual, 0)), 0) AS estoque_atual,
    COALESCE(SUM(ep.estoque_minimo), 0) AS estoque_minimo,
    p.ativo,
    p.criado_em,
    p.atualizado_em,
    (
      SELECT COUNT(*)
      FROM movimentacoes m
      WHERE m.produto_id = p.id
    ) AS movimentacoes_count,
    CASE
      WHEN COALESCE(SUM(COALESCE(lotes.estoque_atual, ep.estoque_atual, 0)), 0) <= 0 THEN 1 ELSE 0
    END AS sem_estoque,
    CASE
      WHEN COALESCE(SUM(ep.estoque_minimo), 0) > 0
       AND COALESCE(SUM(COALESCE(lotes.estoque_atual, ep.estoque_atual, 0)), 0) <= COALESCE(SUM(ep.estoque_minimo), 0)
      THEN 1 ELSE 0
    END AS estoque_baixo
  FROM produtos p
  LEFT JOIN categorias c ON c.id = p.categoria_id
  INNER JOIN estoque_produtos ep ON ep.produto_id = p.id
  LEFT JOIN (
    SELECT estoque_produto_id,
      COALESCE(SUM(quantidade), 0) AS estoque_atual,
      MIN(CASE WHEN quantidade > 0 THEN data_validade ELSE NULL END) AS data_validade
    FROM produto_lotes
    GROUP BY estoque_produto_id
  ) lotes ON lotes.estoque_produto_id = ep.id
`;

const GROUP_ALL_STOCKS = `
  GROUP BY
    p.id,
    p.codigo_barras,
    p.nome,
    p.categoria_id,
    c.nome,
    c.exige_validade,
    p.unidade,
    p.preco_venda,
    p.ativo,
    p.criado_em,
    p.atualizado_em
`;

function isAllStocks(estoque_id) {
  return estoque_id === "all";
}

async function resolveEstoqueId(estoque_id) {
  if (isAllStocks(estoque_id)) return null;
  if (estoque_id) return Number(estoque_id);

  const estoque = await estoqueService.findDefaultActive();
  if (!estoque) {
    throw Object.assign(new Error("Nenhum estoque ativo encontrado"), {
      status: 400,
    });
  }

  return estoque.id;
}

async function listAll(estoque_id) {
  if (isAllStocks(estoque_id)) {
    const [rows] = await pool.query(
      `${SELECT_ALL_STOCKS} ${GROUP_ALL_STOCKS} ORDER BY p.nome ASC`,
    );
    return rows;
  }

  const estoqueId = await resolveEstoqueId(estoque_id);
  const [rows] = await pool.query(`${SELECT_SPECIFIC_STOCK} ORDER BY p.nome ASC`, [
    estoqueId,
  ]);
  return rows;
}

async function findByBarcode(codigo_barras, estoque_id) {
  if (isAllStocks(estoque_id)) {
    const [rows] = await pool.query(
      `${SELECT_ALL_STOCKS} WHERE p.codigo_barras = ? ${GROUP_ALL_STOCKS} LIMIT 1`,
      [codigo_barras],
    );
    return rows[0] || null;
  }

  const estoqueId = await resolveEstoqueId(estoque_id);
  const [rows] = await pool.query(
    `${SELECT_SPECIFIC_STOCK} WHERE p.codigo_barras = ? LIMIT 1`,
    [estoqueId, codigo_barras],
  );
  return rows[0] || null;
}

async function findById(id, estoque_id) {
  if (isAllStocks(estoque_id)) {
    const [rows] = await pool.query(
      `${SELECT_ALL_STOCKS} WHERE p.id = ? ${GROUP_ALL_STOCKS} LIMIT 1`,
      [id],
    );
    return rows[0] || null;
  }

  const estoqueId = await resolveEstoqueId(estoque_id);
  const [rows] = await pool.query(`${SELECT_SPECIFIC_STOCK} WHERE p.id = ? LIMIT 1`, [
    estoqueId,
    id,
  ]);
  return rows[0] || null;
}

async function existsByBarcode(codigo_barras) {
  const [rows] = await pool.query("SELECT id FROM produtos WHERE codigo_barras = ? LIMIT 1", [
    codigo_barras,
  ]);
  return rows.length > 0;
}

async function existsByBarcodeExceptId(codigo_barras, id) {
  const [rows] = await pool.query(
    "SELECT id FROM produtos WHERE codigo_barras = ? AND id <> ? LIMIT 1",
    [codigo_barras, id],
  );
  return rows.length > 0;
}

function normalizeDateOnly(data_validade) {
  if (data_validade === undefined) return undefined;
  if (data_validade === null || data_validade === "") return null;

  const value = String(data_validade).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw Object.assign(new Error("data_validade inválida"), {
      status: 400,
    });
  }

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw Object.assign(new Error("data_validade inválida"), {
      status: 400,
    });
  }

  return value;
}

async function getCategoryRequirement(categoria_id, conn = pool) {
  const [rows] = await conn.query(
    "SELECT id, COALESCE(exige_validade, 0) AS exige_validade FROM categorias WHERE id = ? LIMIT 1",
    [categoria_id],
  );

  if (!rows.length) {
    throw Object.assign(new Error("Categoria não encontrada"), {
      status: 404,
    });
  }

  return !!rows[0].exige_validade;
}

async function resolveValidity(categoria_id, data_validade, conn = pool) {
  const exigeValidade = await getCategoryRequirement(categoria_id, conn);
  const normalizedDate = normalizeDateOnly(data_validade);

  if (exigeValidade && !normalizedDate) {
    throw Object.assign(new Error("Data de validade obrigatória para esta categoria"), {
      status: 400,
    });
  }

  return exigeValidade ? normalizedDate : null;
}

async function createWithConnection(conn, data) {
  const {
    codigo_barras,
    nome,
    categoria_id,
    unidade,
    preco_venda,
    estoque_id,
    estoque_atual,
    estoque_minimo,
    data_validade,
    lote,
    ativo,
  } = data;

  const [existingProducts] = await conn.query(
    "SELECT id, categoria_id FROM produtos WHERE codigo_barras = ? LIMIT 1",
    [codigo_barras],
  );

  let produtoId;
  let produtoCategoriaId = categoria_id;

  if (existingProducts.length) {
    produtoId = existingProducts[0].id;
    produtoCategoriaId = existingProducts[0].categoria_id;
  } else {
    const [produtoResult] = await conn.query(
      `INSERT INTO produtos
          (codigo_barras, nome, categoria_id, unidade, preco_venda, ativo, criado_em, atualizado_em)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [codigo_barras, nome, categoria_id, unidade, preco_venda, ativo ? 1 : 0],
    );
    produtoId = produtoResult.insertId;
  }

  const validade = await resolveValidity(produtoCategoriaId, data_validade, conn);

  const [existingLink] = await conn.query(
    "SELECT id FROM estoque_produtos WHERE estoque_id = ? AND produto_id = ? LIMIT 1",
    [estoque_id, produtoId],
  );

  if (existingLink.length) {
    throw Object.assign(new Error("Produto ja vinculado a este estoque"), {
      status: 409,
    });
  }

  const [linkResult] = await conn.query(
    `INSERT INTO estoque_produtos
        (estoque_id, produto_id, estoque_atual, estoque_minimo, data_validade, criado_em)
       VALUES (?, ?, 0, ?, NULL, NOW())`,
    [estoque_id, produtoId, estoque_minimo],
  );

  if (Number(estoque_atual) > 0 || lote) {
    const loteCriado = await loteService.upsertLot(conn, linkResult.insertId, {
      lote,
      data_validade: validade,
      quantidade: Number(estoque_atual) || 0,
      categoria_id: produtoCategoriaId,
    });
    await loteService.recalcStockProduct(conn, loteCriado.estoque_produto_id);
  }

  return { produtoId, estoqueId: estoque_id };
}

async function create(data) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();
    const created = await createWithConnection(conn, data);

    await conn.commit();

    return findById(created.produtoId, created.estoqueId);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function createMany(items) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const createdRows = [];
    for (const [index, item] of items.entries()) {
      try {
        const created = await createWithConnection(conn, item);
        createdRows.push(created);
      } catch (e) {
        if (!String(e.message || "").startsWith("Linha ")) {
          e.message = `Linha ${index + 1}: ${e.message}`;
        }
        throw e;
      }
    }

    await conn.commit();

    const products = [];
    for (const created of createdRows) {
      products.push(await findById(created.produtoId, created.estoqueId));
    }
    return products;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function update(id, data) {
  const existing = await findById(id, "all");
  if (!existing) {
    throw Object.assign(new Error("Produto não encontrado"), {
      status: 404,
    });
  }

  const {
    codigo_barras,
    nome,
    categoria_id,
    unidade,
    preco_venda,
    estoque_id,
    data_validade,
    ativo,
  } = data;

  if (codigo_barras && (await existsByBarcodeExceptId(codigo_barras, id))) {
    throw Object.assign(new Error("Código de barras já cadastrado"), {
      status: 409,
    });
  }

  const fields = [];
  const values = [];

  if (codigo_barras !== undefined) {
    fields.push("codigo_barras = ?");
    values.push(codigo_barras);
  }
  if (nome !== undefined) {
    fields.push("nome = ?");
    values.push(nome);
  }
  if (categoria_id !== undefined) {
    fields.push("categoria_id = ?");
    values.push(categoria_id);
  }
  if (unidade !== undefined) {
    fields.push("unidade = ?");
    values.push(unidade);
  }
  if (preco_venda !== undefined) {
    fields.push("preco_venda = ?");
    values.push(preco_venda);
  }
  if (ativo !== undefined) {
    fields.push("ativo = ?");
    values.push(ativo ? 1 : 0);
  }

  const shouldUpdateValidity = data_validade !== undefined || estoque_id !== undefined;
  let validade;
  if (shouldUpdateValidity) {
    const targetEstoqueId = Number(estoque_id);
    if (!targetEstoqueId) {
      throw Object.assign(new Error("estoque_id é obrigatório para atualizar validade"), {
        status: 400,
      });
    }

    const targetCategoryId = categoria_id !== undefined ? categoria_id : existing.categoria_id;
    validade = await resolveValidity(targetCategoryId, data_validade);
  }

  if (!fields.length && !shouldUpdateValidity) return existing;

  if (fields.length) {
    fields.push("atualizado_em = NOW()");
    values.push(id);

    await pool.query(`UPDATE produtos SET ${fields.join(", ")} WHERE id = ?`, values);
  }

  if (shouldUpdateValidity) {
    const [result] = await pool.query(
      "UPDATE estoque_produtos SET data_validade = NULL WHERE produto_id = ? AND estoque_id = ?",
      [id, Number(estoque_id)],
    );

    if (!result.affectedRows) {
      throw Object.assign(new Error("Produto não vinculado a este estoque"), {
        status: 404,
      });
    }
  }

  return findById(id, estoque_id || "all");
}

async function listLotes(id, estoque_id) {
  return loteService.listByProductStock(Number(id), estoque_id);
}

async function updateLote(produtoId, loteId, data) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT
         pl.id,
         pl.estoque_produto_id,
         pl.lote,
         pl.data_validade,
         pl.quantidade,
         ep.produto_id,
         p.categoria_id,
         COALESCE(c.exige_validade, 0) AS exige_validade
       FROM produto_lotes pl
       INNER JOIN estoque_produtos ep ON ep.id = pl.estoque_produto_id
       INNER JOIN produtos p ON p.id = ep.produto_id
       LEFT JOIN categorias c ON c.id = p.categoria_id
       WHERE pl.id = ? AND ep.produto_id = ?
       LIMIT 1
       FOR UPDATE`,
      [loteId, produtoId],
    );

    if (!rows.length) {
      throw Object.assign(new Error("Lote não encontrado para este produto"), { status: 404 });
    }

    const current = rows[0];
    const lote =
      data.lote !== undefined
        ? await loteService.normalizeLotForCategory(current.categoria_id, data.lote, conn)
        : current.lote;
    const dataValidade =
      data.data_validade !== undefined
        ? await loteService.resolveLotValidity(current.categoria_id, data.data_validade, conn)
        : current.data_validade;
    const quantidade =
      data.quantidade !== undefined ? Number(data.quantidade) : Number(current.quantidade || 0);

    if (current.exige_validade && !dataValidade) {
      throw Object.assign(new Error("Data de validade obrigatória para esta categoria"), {
        status: 400,
      });
    }
    if (!Number.isFinite(quantidade) || quantidade < 0) {
      throw Object.assign(new Error("quantidade inválida"), { status: 400 });
    }

    const [duplicated] = await conn.query(
      `SELECT id
       FROM produto_lotes
       WHERE estoque_produto_id = ? AND lote = ? AND id <> ?
       LIMIT 1`,
      [current.estoque_produto_id, lote, loteId],
    );

    if (duplicated.length) {
      throw Object.assign(new Error("Ja existe este lote neste estoque"), { status: 409 });
    }

    await conn.query(
      `UPDATE produto_lotes
       SET lote = ?, data_validade = ?, quantidade = ?, atualizado_em = NOW()
       WHERE id = ?`,
      [lote, dataValidade || null, quantidade, loteId],
    );

    await loteService.recalcStockProduct(conn, current.estoque_produto_id);
    await conn.commit();

    const lotes = await listLotes(produtoId, "all");
    return lotes.find((item) => Number(item.id) === Number(loteId));
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function setStatus(id, ativo) {
  const [result] = await pool.query(
    "UPDATE produtos SET ativo = ?, atualizado_em = NOW() WHERE id = ?",
    [ativo ? 1 : 0, id],
  );

  if (!result.affectedRows) {
    throw Object.assign(new Error("Produto não encontrado"), {
      status: 404,
    });
  }

  return findById(id, "all");
}

async function remove(id) {
  const [movements] = await pool.query(
    "SELECT id FROM movimentacoes WHERE produto_id = ? LIMIT 1",
    [id],
  );

  if (movements.length) {
    throw Object.assign(new Error("Produto com movimentações não pode ser excluído"), {
      status: 409,
    });
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await conn.query("DELETE FROM alertas_estoque WHERE produto_id = ?", [id]);
    await conn.query("DELETE FROM estoque_produtos WHERE produto_id = ?", [id]);
    const [result] = await conn.query("DELETE FROM produtos WHERE id = ?", [id]);

    if (!result.affectedRows) {
      throw Object.assign(new Error("Produto não encontrado"), {
        status: 404,
      });
    }

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

module.exports = {
  listAll,
  findByBarcode,
  findById,
  existsByBarcode,
  create,
  createMany,
  update,
  setStatus,
  remove,
  listLotes,
  updateLote,
  resolveEstoqueId,
  isAllStocks,
};
