const { pool } = require("../database/connection");
const estoqueService = require("./estoqueService");

const SELECT_SPECIFIC_STOCK = `
  SELECT
    p.id,
    p.codigo_barras,
    p.nome,
    p.categoria_id,
    c.nome AS categoria_nome,
    p.unidade,
    p.preco_venda,
    ep.estoque_id,
    e.nome AS estoque_nome,
    COALESCE(ep.estoque_atual, 0) AS estoque_atual,
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
      WHEN COALESCE(ep.estoque_atual, 0) <= 0 THEN 1 ELSE 0
    END AS sem_estoque,
    CASE
      WHEN COALESCE(ep.estoque_minimo, 0) > 0
       AND COALESCE(ep.estoque_atual, 0) <= COALESCE(ep.estoque_minimo, 0)
      THEN 1 ELSE 0
    END AS estoque_baixo
  FROM produtos p
  LEFT JOIN categorias c ON c.id = p.categoria_id
  INNER JOIN estoque_produtos ep ON ep.produto_id = p.id AND ep.estoque_id = ?
  INNER JOIN estoques e ON e.id = ep.estoque_id
`;

const SELECT_ALL_STOCKS = `
  SELECT
    p.id,
    p.codigo_barras,
    p.nome,
    p.categoria_id,
    c.nome AS categoria_nome,
    p.unidade,
    p.preco_venda,
    NULL AS estoque_id,
    'Todos os estoques' AS estoque_nome,
    COALESCE(SUM(ep.estoque_atual), 0) AS estoque_atual,
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
      WHEN COALESCE(SUM(ep.estoque_atual), 0) <= 0 THEN 1 ELSE 0
    END AS sem_estoque,
    CASE
      WHEN COALESCE(SUM(ep.estoque_minimo), 0) > 0
       AND COALESCE(SUM(ep.estoque_atual), 0) <= COALESCE(SUM(ep.estoque_minimo), 0)
      THEN 1 ELSE 0
    END AS estoque_baixo
  FROM produtos p
  LEFT JOIN categorias c ON c.id = p.categoria_id
  INNER JOIN estoque_produtos ep ON ep.produto_id = p.id
`;

const GROUP_ALL_STOCKS = `
  GROUP BY
    p.id,
    p.codigo_barras,
    p.nome,
    p.categoria_id,
    c.nome,
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

async function create(data) {
  const {
    codigo_barras,
    nome,
    categoria_id,
    unidade,
    preco_venda,
    estoque_id,
    estoque_atual,
    estoque_minimo,
    ativo,
  } = data;

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [existingProducts] = await conn.query(
      "SELECT id FROM produtos WHERE codigo_barras = ? LIMIT 1",
      [codigo_barras],
    );

    let produtoId;
    if (existingProducts.length) {
      produtoId = existingProducts[0].id;
    } else {
      const [produtoResult] = await conn.query(
        `INSERT INTO produtos
          (codigo_barras, nome, categoria_id, unidade, preco_venda, ativo, criado_em, atualizado_em)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [codigo_barras, nome, categoria_id, unidade, preco_venda, ativo ? 1 : 0],
      );
      produtoId = produtoResult.insertId;
    }

    const [existingLink] = await conn.query(
      "SELECT id FROM estoque_produtos WHERE estoque_id = ? AND produto_id = ? LIMIT 1",
      [estoque_id, produtoId],
    );

    if (existingLink.length) {
      throw Object.assign(new Error("Produto ja vinculado a este estoque"), {
        status: 409,
      });
    }

    await conn.query(
      `INSERT INTO estoque_produtos
        (estoque_id, produto_id, estoque_atual, estoque_minimo, criado_em)
       VALUES (?, ?, ?, ?, NOW())`,
      [estoque_id, produtoId, estoque_atual, estoque_minimo],
    );

    await conn.commit();

    return findById(produtoId, estoque_id);
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
    throw Object.assign(new Error("Produto nao encontrado"), {
      status: 404,
    });
  }

  const {
    codigo_barras,
    nome,
    categoria_id,
    unidade,
    preco_venda,
    ativo,
  } = data;

  if (codigo_barras && (await existsByBarcodeExceptId(codigo_barras, id))) {
    throw Object.assign(new Error("Codigo de barras ja cadastrado"), {
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

  if (!fields.length) return existing;

  fields.push("atualizado_em = NOW()");
  values.push(id);

  await pool.query(`UPDATE produtos SET ${fields.join(", ")} WHERE id = ?`, values);

  return findById(id, "all");
}

async function setStatus(id, ativo) {
  const [result] = await pool.query(
    "UPDATE produtos SET ativo = ?, atualizado_em = NOW() WHERE id = ?",
    [ativo ? 1 : 0, id],
  );

  if (!result.affectedRows) {
    throw Object.assign(new Error("Produto nao encontrado"), {
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
    throw Object.assign(new Error("Produto com movimentacoes nao pode ser excluido"), {
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
      throw Object.assign(new Error("Produto nao encontrado"), {
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
  update,
  setStatus,
  remove,
  resolveEstoqueId,
  isAllStocks,
};
