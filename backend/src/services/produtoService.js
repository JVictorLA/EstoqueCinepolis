const { pool } = require("../database/connection");

/**
 * Acesso de leitura/escrita para a tabela `produtos`.
 * Usa EXATAMENTE os nomes de colunas do banco real:
 *   id, codigo_barras, nome, categoria_id, unidade,
 *   preco_venda, estoque_atual, estoque_minimo, ativo,
 *   criado_em, atualizado_em
 */

const SELECT_WITH_CATEGORY = `
  SELECT
    p.id,
    p.codigo_barras,
    p.nome,
    p.categoria_id,
    c.nome AS categoria_nome,
    p.unidade,
    p.preco_venda,
    p.estoque_atual,
    p.estoque_minimo,
    p.ativo,
    p.criado_em,
    p.atualizado_em,
    CASE
      WHEN p.estoque_atual <= 0 THEN 1 ELSE 0
    END AS sem_estoque,
    CASE
      WHEN p.estoque_atual > 0 AND p.estoque_atual <= p.estoque_minimo THEN 1 ELSE 0
    END AS estoque_baixo
  FROM produtos p
  LEFT JOIN categorias c ON c.id = p.categoria_id
`;

async function listAll() {
  const [rows] = await pool.query(`${SELECT_WITH_CATEGORY} ORDER BY p.nome ASC`);
  return rows;
}

async function findByBarcode(codigo_barras) {
  const [rows] = await pool.query(
    `${SELECT_WITH_CATEGORY} WHERE p.codigo_barras = ? LIMIT 1`,
    [codigo_barras]
  );
  return rows[0] || null;
}

async function findById(id) {
  const [rows] = await pool.query(
    `${SELECT_WITH_CATEGORY} WHERE p.id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function existsByBarcode(codigo_barras) {
  const [rows] = await pool.query(
    "SELECT id FROM produtos WHERE codigo_barras = ? LIMIT 1",
    [codigo_barras]
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
    estoque_atual,
    estoque_minimo,
    ativo,
  } = data;

  const [result] = await pool.query(
    `INSERT INTO produtos
      (codigo_barras, nome, categoria_id, unidade, preco_venda,
       estoque_atual, estoque_minimo, ativo, criado_em, atualizado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      codigo_barras,
      nome,
      categoria_id,
      unidade,
      preco_venda,
      estoque_atual,
      estoque_minimo,
      ativo ? 1 : 0,
    ]
  );

  return findById(result.insertId);
}

module.exports = {
  listAll,
  findByBarcode,
  findById,
  existsByBarcode,
  create,
};
