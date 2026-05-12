const bcrypt = require("bcrypt");
const { pool } = require("../database/connection");

/**
 * Tabela `usuarios`:
 *   id, matricula, nome, email, senha_hash, tipo, ativo, criado_em
 */

const PUBLIC_FIELDS =
  "id, matricula, nome, email, tipo, ativo, criado_em, precisa_trocar_senha";

async function listAll() {
  const [rows] = await pool.query(
    `SELECT ${PUBLIC_FIELDS} FROM usuarios ORDER BY nome ASC`
  );
  return rows;
}

async function findById(id) {
  const [rows] = await pool.query(
    `SELECT ${PUBLIC_FIELDS} FROM usuarios WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function findByMatricula(matricula) {
  const [rows] = await pool.query(
    `SELECT 
      id,
      matricula,
      nome,
      email,
      senha_hash,
      tipo,
      ativo,
      criado_em,
      precisa_trocar_senha
     FROM usuarios 
     WHERE matricula = ? 
     LIMIT 1`,
    [matricula]
  );

  return rows[0] || null;
}

async function existsByMatricula(matricula) {
  const [rows] = await pool.query(
    "SELECT id FROM usuarios WHERE matricula = ? LIMIT 1",
    [matricula]
  );
  return rows.length > 0;
}

async function create({ matricula, nome, email, senha, tipo, ativo }) {
  const senha_hash = await bcrypt.hash(senha, 10);

  const [result] = await pool.query(
    `INSERT INTO usuarios
      (
        matricula,
        nome,
        email,
        senha_hash,
        tipo,
        ativo,
        criado_em,
        precisa_trocar_senha
      )
     VALUES (?, ?, ?, ?, ?, ?, NOW(), 1)`,
    [
      matricula,
      nome,
      email,
      senha_hash,
      tipo,
      ativo ? 1 : 0
    ]
  );

  return findById(result.insertId);
}
async function update(id, { matricula, nome, email, senha, tipo, ativo }) {
  const fields = [];
  const values = [];

  if (matricula !== undefined) {
    fields.push("matricula = ?");
    values.push(matricula);
  }

  if (nome !== undefined) {
    fields.push("nome = ?");
    values.push(nome);
  }

  if (email !== undefined) {
    fields.push("email = ?");
    values.push(email);
  }

  if (tipo !== undefined) {
    fields.push("tipo = ?");
    values.push(tipo);
  }

  if (ativo !== undefined) {
    fields.push("ativo = ?");
    values.push(ativo ? 1 : 0);
  }

  // 🔥 ALTERAÇÃO DE SENHA
  if (senha) {
    const senha_hash = await bcrypt.hash(senha, 10);

    fields.push("senha_hash = ?");
    values.push(senha_hash);

    // 🔥 usuário já trocou a senha
    fields.push("precisa_trocar_senha = 0");
  }

  if (!fields.length) return findById(id);

  values.push(id);

  await pool.query(
    `UPDATE usuarios SET ${fields.join(", ")} WHERE id = ?`,
    values
  );

  return findById(id);
}

async function setStatus(id, ativo) {
  await pool.query("UPDATE usuarios SET ativo = ? WHERE id = ?", [ativo ? 1 : 0, id]);
  return findById(id);
}

async function resetPassword(id) {
  const senha_hash = await bcrypt.hash("123456", 10);

  await pool.query(
    `UPDATE usuarios
     SET senha_hash = ?,
         precisa_trocar_senha = 1
     WHERE id = ?`,
    [senha_hash, id]
  );

  return findById(id);
}

/**
 * Valida matrícula + senha. Retorna o usuário (sem hash) se OK, ou null.
 * Bloqueia usuários inativos.
 */
async function validateCredentials(matricula, senha) {
  const u = await findByMatricula(matricula);
  if (!u) return null;
  if (!u.ativo) return { error: "inactive" };
  const ok = await bcrypt.compare(senha, u.senha_hash || "");
  if (!ok) return null;
 const { senha_hash, ...safe } = u;

return {
  ...safe,
  precisa_trocar_senha: !!u.precisa_trocar_senha
};
}

async function findByIdWithPassword(id) {
  const [rows] = await pool.query(
    `SELECT id, matricula, nome, email, senha_hash, tipo, ativo
     FROM usuarios WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

module.exports = {
  listAll,
  findById,
  findByMatricula,
  findByIdWithPassword,
  existsByMatricula,
  create,
  update,
  setStatus,
  validateCredentials,
  resetPassword
};
