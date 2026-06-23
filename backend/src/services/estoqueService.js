const { pool } = require("../database/connection");

const PUBLIC_FIELDS = `
  id,
  nome,
  ativo,
  COALESCE(tipo, 'permanente') AS tipo,
  COALESCE(arquivado, 0) AS arquivado,
  arquivado_em,
  criado_em
`;

async function listAll() {
  const [rows] = await pool.query(`SELECT ${PUBLIC_FIELDS} FROM estoques ORDER BY nome ASC`);
  return rows;
}

async function findById(id) {
  const [rows] = await pool.query(`SELECT ${PUBLIC_FIELDS} FROM estoques WHERE id = ? LIMIT 1`, [
    id,
  ]);
  return rows[0] || null;
}

async function findDefaultActive() {
  const [rows] = await pool.query(
    `SELECT ${PUBLIC_FIELDS}
     FROM estoques
     WHERE ativo = 1 AND COALESCE(arquivado, 0) = 0
     ORDER BY nome ASC
     LIMIT 1`,
  );
  return rows[0] || null;
}

async function existsByName(nome) {
  const [rows] = await pool.query("SELECT id FROM estoques WHERE LOWER(nome) = LOWER(?) LIMIT 1", [
    nome,
  ]);
  return rows.length > 0;
}

function normalizeTipo(tipo) {
  return tipo === "temporario" ? "temporario" : "permanente";
}

async function create({ nome, ativo, tipo }) {
  const [result] = await pool.query(
    `INSERT INTO estoques (nome, ativo, tipo, arquivado, criado_em)
     VALUES (?, ?, ?, 0, NOW())`,
    [nome, ativo ? 1 : 0, normalizeTipo(tipo)],
  );

  return findById(result.insertId);
}

async function setStatus(id, ativo) {
  await pool.query("UPDATE estoques SET ativo = ? WHERE id = ? AND COALESCE(arquivado, 0) = 0", [
    ativo ? 1 : 0,
    id,
  ]);
  return findById(id);
}

async function getTotalSaldo(id) {
  const [[row]] = await pool.query(
    `SELECT COALESCE(SUM(COALESCE(lotes.total_lotes, ep.estoque_atual, 0)), 0) AS total
     FROM estoque_produtos ep
     LEFT JOIN (
       SELECT estoque_produto_id, COALESCE(SUM(quantidade), 0) AS total_lotes
       FROM produto_lotes
       GROUP BY estoque_produto_id
     ) lotes ON lotes.estoque_produto_id = ep.id
     WHERE ep.estoque_id = ?`,
    [id],
  );
  return Number(row?.total || 0);
}

async function archive(id) {
  const estoque = await findById(id);
  if (!estoque) {
    throw Object.assign(new Error("Estoque não encontrado"), { status: 404 });
  }
  if (estoque.tipo !== "temporario") {
    throw Object.assign(new Error("Apenas estoques temporários podem ser arquivados"), {
      status: 400,
    });
  }
  if (estoque.arquivado) return estoque;

  const saldo = await getTotalSaldo(id);
  if (saldo > 0) {
    throw Object.assign(new Error("Transfira ou zere os produtos antes de arquivar"), {
      status: 409,
    });
  }

  await pool.query(
    "UPDATE estoques SET arquivado = 1, ativo = 0, arquivado_em = NOW() WHERE id = ?",
    [id],
  );
  return findById(id);
}

module.exports = {
  listAll,
  findById,
  findDefaultActive,
  existsByName,
  create,
  setStatus,
  archive,
};
