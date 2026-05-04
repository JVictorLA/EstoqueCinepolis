const { pool } = require("../database/connection");

async function listAll() {
  const [rows] = await pool.query("SELECT id, nome FROM categorias ORDER BY nome ASC");
  return rows;
}

module.exports = { listAll };
