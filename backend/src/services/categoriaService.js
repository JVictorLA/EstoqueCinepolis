const { pool } = require("../database/connection");

async function listAll() {
  const [rows] = await pool.query(
    `SELECT
      c.id,
      c.nome,
      COALESCE(c.exige_validade, 0) AS exige_validade,
      COUNT(p.id) AS produtos_vinculados
     FROM categorias c
     LEFT JOIN produtos p ON p.categoria_id = c.id
     GROUP BY c.id, c.nome, c.exige_validade
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

async function create({ nome, exige_validade }) {
  const trimmedName = nome.trim();

  if (await existsByName(trimmedName)) {
    throw Object.assign(new Error("Categoria ja cadastrada"), {
      status: 409,
    });
  }

  const [result] = await pool.query(
    "INSERT INTO categorias (nome, exige_validade) VALUES (?, ?)",
    [trimmedName, exige_validade ? 1 : 0]
  );

  return {
    id: result.insertId,
    nome: trimmedName,
    exige_validade: exige_validade ? 1 : 0,
  };
}

async function update(id, { nome, exige_validade }) {
  const trimmedName = nome.trim();

  if (await existsByName(trimmedName, id)) {
    throw Object.assign(new Error("Categoria ja cadastrada"), {
      status: 409,
    });
  }

  const [result] = await pool.query(
    "UPDATE categorias SET nome = ?, exige_validade = ? WHERE id = ?",
    [trimmedName, exige_validade ? 1 : 0, id]
  );

  if (!result.affectedRows) {
    throw Object.assign(new Error("Categoria nao encontrada"), {
      status: 404,
    });
  }

  return {
    id,
    nome: trimmedName,
    exige_validade: exige_validade ? 1 : 0,
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
