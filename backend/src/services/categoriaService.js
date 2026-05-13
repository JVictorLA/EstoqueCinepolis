const { pool } = require("../database/connection");

async function listAll() {
  const [rows] = await pool.query(
    `SELECT
      c.id,
      c.nome,
      COUNT(p.id) AS produtos_vinculados
     FROM categorias c
     LEFT JOIN produtos p ON p.categoria_id = c.id
     GROUP BY c.id, c.nome
     ORDER BY c.nome ASC`
  );
  return rows;
}

async function existsByName(nome, ignoreId = null) {
  const params = [nome];
  let ignoreClause = "";

  if (ignoreId) {
    ignoreClause = " AND id <> ?";
    params.push(ignoreId);
  }

  const [rows] = await pool.query(
    `SELECT id FROM categorias WHERE LOWER(nome) = LOWER(?)${ignoreClause} LIMIT 1`,
    params
  );
  return rows.length > 0;
}

async function create({ nome }) {
  const trimmedName = nome.trim();

  if (await existsByName(trimmedName)) {
    throw Object.assign(new Error("Categoria ja cadastrada"), {
      status: 409,
    });
  }

  const [result] = await pool.query(
    "INSERT INTO categorias (nome) VALUES (?)",
    [trimmedName]
  );

  return {
    id: result.insertId,
    nome: trimmedName,
  };
}

async function update(id, { nome }) {
  const trimmedName = nome.trim();

  if (await existsByName(trimmedName, id)) {
    throw Object.assign(new Error("Categoria ja cadastrada"), {
      status: 409,
    });
  }

  const [result] = await pool.query(
    "UPDATE categorias SET nome = ? WHERE id = ?",
    [trimmedName, id]
  );

  if (!result.affectedRows) {
    throw Object.assign(new Error("Categoria nao encontrada"), {
      status: 404,
    });
  }

  return {
    id,
    nome: trimmedName,
  };
}

async function remove(id) {
  const [linkedProducts] = await pool.query(
    "SELECT id FROM produtos WHERE categoria_id = ? LIMIT 1",
    [id]
  );

  if (linkedProducts.length) {
    throw Object.assign(new Error("Categoria em uso nao pode ser excluida"), {
      status: 409,
    });
  }

  const [result] = await pool.query("DELETE FROM categorias WHERE id = ?", [id]);

  if (!result.affectedRows) {
    throw Object.assign(new Error("Categoria nao encontrada"), {
      status: 404,
    });
  }
}

module.exports = { listAll, create, update, remove };
