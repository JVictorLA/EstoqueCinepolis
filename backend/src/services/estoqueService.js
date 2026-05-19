const { pool } = require("../database/connection");

const PUBLIC_FIELDS = "id, nome, ativo, criado_em";

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
     WHERE ativo = 1
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

async function create({ nome, ativo }) {
  const [result] = await pool.query(
    `INSERT INTO estoques (nome, ativo, criado_em)
     VALUES (?, ?, NOW())`,
    [nome, ativo ? 1 : 0],
  );

  return findById(result.insertId);
}

async function setStatus(id, ativo) {
  await pool.query("UPDATE estoques SET ativo = ? WHERE id = ?", [ativo ? 1 : 0, id]);
  return findById(id);
}

module.exports = {
  listAll,
  findById,
  findDefaultActive,
  existsByName,
  create,
  setStatus,
};
