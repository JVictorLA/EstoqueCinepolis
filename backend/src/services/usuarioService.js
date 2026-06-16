const bcrypt = require("bcrypt");
const { pool } = require("../database/connection");

/**
 * Tabela `usuarios`:
 *   id, matricula, nome, email, senha_hash, tipo, ativo, criado_em,
 *   atualizado_em, senha_atualizada_em, theme_preference
 */

const PUBLIC_FIELDS =
  "id, matricula, nome, email, tipo, ativo, criado_em, atualizado_em, senha_atualizada_em, precisa_trocar_senha, theme_preference";
const PASSWORD_MAX_AGE_DAYS = 7;

function getTemporaryPassword() {
  if (!process.env.DEFAULT_TEMPORARY_PASSWORD) {
    throw new Error("DEFAULT_TEMPORARY_PASSWORD is required to create or reset temporary passwords");
  }
  return process.env.DEFAULT_TEMPORARY_PASSWORD;
}

function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isPasswordExpired(user) {
  const passwordUpdatedAt = parseDate(user?.senha_atualizada_em) || parseDate(user?.criado_em);
  if (!passwordUpdatedAt) return false;
  const diffMs = Date.now() - passwordUpdatedAt.getTime();
  return diffMs >= PASSWORD_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}

function getPasswordStatus(user) {
  if (user?.precisa_trocar_senha) return "first_access";
  if (isPasswordExpired(user)) return "expired";
  return null;
}

function buildAuthUser(user) {
  const passwordStatus = getPasswordStatus(user);
  return {
    id: user.id,
    matricula: user.matricula,
    nome: user.nome,
    email: user.email,
    tipo: user.tipo,
    ativo: !!user.ativo,
    theme_preference: user.theme_preference === "dark" ? "dark" : "light",
    precisa_trocar_senha: !!user.precisa_trocar_senha,
    senha_expirada: passwordStatus === "expired",
    password_status: passwordStatus,
  };
}

function buildPasswordChallenge(user) {
  const authUser = buildAuthUser(user);
  return {
    password_status: authUser.password_status,
    usuario: {
      id: authUser.id,
      matricula: authUser.matricula,
      nome: authUser.nome,
      tipo: authUser.tipo,
      themePreference: authUser.theme_preference,
      precisaTrocarSenha: authUser.precisa_trocar_senha,
      senhaExpirada: authUser.senha_expirada,
    },
  };
}

async function listAll({ includeMaster = false } = {}) {
  const where = includeMaster ? "" : "WHERE tipo <> 'master'";
  const [rows] = await pool.query(
    `SELECT ${PUBLIC_FIELDS} FROM usuarios ${where} ORDER BY nome ASC`,
  );
  return rows;
}

async function findById(id) {
  const [rows] = await pool.query(`SELECT ${PUBLIC_FIELDS} FROM usuarios WHERE id = ? LIMIT 1`, [
    id,
  ]);
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
      atualizado_em,
      senha_atualizada_em,
      precisa_trocar_senha,
      theme_preference
     FROM usuarios
     WHERE matricula = ?
     LIMIT 1`,
    [matricula],
  );

  return rows[0] || null;
}

async function existsByMatricula(matricula) {
  const [rows] = await pool.query("SELECT id FROM usuarios WHERE matricula = ? LIMIT 1", [
    matricula,
  ]);
  return rows.length > 0;
}

async function existsAdminOrMaster() {
  const [rows] = await pool.query(
    "SELECT id FROM usuarios WHERE tipo IN ('master', 'admin') LIMIT 1",
  );
  return rows.length > 0;
}

async function create({ matricula, nome, email, senha, tipo, ativo }) {
  const senha_hash = await bcrypt.hash(senha || getTemporaryPassword(), 10);

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
        atualizado_em,
        senha_atualizada_em,
        precisa_trocar_senha
      )
     VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW(), 1)`,
    [matricula, nome, email, senha_hash, tipo, ativo ? 1 : 0],
  );

  return findById(result.insertId);
}

async function createMaster({ matricula, nome, email, senha }) {
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
        atualizado_em,
        senha_atualizada_em,
        precisa_trocar_senha
      )
     VALUES (?, ?, ?, ?, 'master', 1, NOW(), NOW(), NOW(), 0)`,
    [matricula, nome, email, senha_hash],
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

  fields.push("atualizado_em = NOW()");

  if (senha) {
    const senha_hash = await bcrypt.hash(senha, 10);
    fields.push("senha_hash = ?");
    values.push(senha_hash);
    fields.push("senha_atualizada_em = NOW()");
    fields.push("precisa_trocar_senha = 0");
  }

  values.push(id);
  await pool.query(`UPDATE usuarios SET ${fields.join(", ")} WHERE id = ?`, values);

  return findById(id);
}

async function updateThemePreference(id, themePreference) {
  await pool.query("UPDATE usuarios SET theme_preference = ?, atualizado_em = NOW() WHERE id = ?", [
    themePreference,
    id,
  ]);
  return findById(id);
}

async function setStatus(id, ativo) {
  await pool.query("UPDATE usuarios SET ativo = ?, atualizado_em = NOW() WHERE id = ?", [
    ativo ? 1 : 0,
    id,
  ]);
  return findById(id);
}

async function resetPassword(id) {
  const senha_hash = await bcrypt.hash(getTemporaryPassword(), 10);

  await pool.query(
    `UPDATE usuarios
     SET senha_hash = ?,
         atualizado_em = NOW(),
         senha_atualizada_em = NOW(),
         precisa_trocar_senha = 1
     WHERE id = ?`,
    [senha_hash, id],
  );

  return findById(id);
}

async function validateCredentials(matricula, senha) {
  const user = await findByMatricula(matricula);
  if (!user) return null;
  if (!user.ativo) return { error: "inactive" };

  const passwordMatches = await bcrypt.compare(senha, user.senha_hash || "");
  if (!passwordMatches) return null;

  return buildAuthUser(user);
}

async function findByIdWithPassword(id) {
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
       atualizado_em,
       senha_atualizada_em,
       precisa_trocar_senha,
       theme_preference
     FROM usuarios
     WHERE id = ?
     LIMIT 1`,
    [id],
  );
  return rows[0] || null;
}

module.exports = {
  listAll,
  findById,
  findByMatricula,
  findByIdWithPassword,
  existsByMatricula,
  existsAdminOrMaster,
  create,
  createMaster,
  update,
  updateThemePreference,
  setStatus,
  validateCredentials,
  resetPassword,
  buildPasswordChallenge,
  getPasswordStatus,
};
