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
const MAX_FAILED_PASSWORD_ATTEMPTS = 5;
const FAILED_ATTEMPTS_AFTER_LOCK = 3;
const PASSWORD_LOCK_SECONDS = [15, 30, 60];
const FINAL_LOCK_LEVEL = PASSWORD_LOCK_SECONDS.length;
const AUTO_DISABLE_MESSAGE =
  "Usuario desabilitado por seguranca. Procure um administrador ou o tecnico de TI para desbloquear e recuperar sua senha.";

function getTemporaryPassword() {
  if (!process.env.DEFAULT_TEMPORARY_PASSWORD) {
    throw new Error(
      "DEFAULT_TEMPORARY_PASSWORD is required to create or reset temporary passwords",
    );
  }
  return process.env.DEFAULT_TEMPORARY_PASSWORD;
}

function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isPasswordExpired(user) {
  const passwordUpdatedAt = parseDate(user.senha_atualizada_em) || parseDate(user.criado_em);
  if (!passwordUpdatedAt) return false;
  const diffMs = Date.now() - passwordUpdatedAt.getTime();
  return diffMs >= PASSWORD_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}

function getPasswordStatus(user) {
  if (user.precisa_trocar_senha) return "first_access";
  if (isPasswordExpired(user)) return "expired";
  return null;
}

function getLockRemainingSeconds(user) {
  const lockedUntil = parseDate(user.login_bloqueado_ate);
  if (!lockedUntil) return 0;
  return Math.max(0, Math.ceil((lockedUntil.getTime() - Date.now()) / 1000));
}

function buildLockedCredentialResult(user, retryAfterSeconds = getLockRemainingSeconds(user)) {
  const currentLevel = Number(user.login_bloqueio_nivel || 0);
  return {
    error: "locked",
    status: 403,
    message: `Usuário temporariamente bloqueado por muitas tentativas inválidas. Tente novamente em ${retryAfterSeconds} segundos.`,
    retry_after_seconds: retryAfterSeconds,
    login_bloqueado_ate: user.login_bloqueado_ate,
    aviso_ultimas_tentativas_apos_timer: currentLevel >= FINAL_LOCK_LEVEL,
  };
}

function buildAutoDisabledCredentialResult() {
  return {
    error: "disabled_by_password_attempts",
    status: 403,
    message: AUTO_DISABLE_MESSAGE,
    usuario_desabilitado_por_senha: true,
  };
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
  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      can_delete: await canDelete(row.id),
    })),
  );
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
      login_tentativas_falhas,
      login_bloqueado_ate,
      login_bloqueio_nivel,
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
    fields.push("login_tentativas_falhas = 0");
    fields.push("login_bloqueado_ate = NULL");
    fields.push("login_bloqueio_nivel = 0");
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
         precisa_trocar_senha = 1,
         login_tentativas_falhas = 0,
         login_bloqueado_ate = NULL,
         login_bloqueio_nivel = 0
     WHERE id = ?`,
    [senha_hash, id],
  );

  return findById(id);
}

async function resetPasswordFailures(id) {
  await pool.query(
    `UPDATE usuarios
     SET login_tentativas_falhas = 0,
         login_bloqueado_ate = NULL,
         login_bloqueio_nivel = 0,
         atualizado_em = NOW()
     WHERE id = ?`,
    [id],
  );
}

async function registerFailedPasswordAttempt(user) {
  const currentFailures = Number(user.login_tentativas_falhas || 0);
  const currentLevel = Number(user.login_bloqueio_nivel || 0);
  const remainingLockSeconds = getLockRemainingSeconds(user);
  if (remainingLockSeconds > 0) {
    return buildLockedCredentialResult(user, remainingLockSeconds);
  }

  const nextFailures = currentFailures + 1;
  const attemptsBeforeNextLock =
    currentLevel === 0 ? MAX_FAILED_PASSWORD_ATTEMPTS : FAILED_ATTEMPTS_AFTER_LOCK;

  if (nextFailures < attemptsBeforeNextLock) {
    await pool.query(
      `UPDATE usuarios
       SET login_tentativas_falhas = ?,
           atualizado_em = NOW()
       WHERE id = ?`,
      [nextFailures, user.id],
    );
    return null;
  }

  if (currentLevel >= FINAL_LOCK_LEVEL) {
    if (user.tipo === "master") {
      const lockSeconds = PASSWORD_LOCK_SECONDS[PASSWORD_LOCK_SECONDS.length - 1];
      await pool.query(
        `UPDATE usuarios
         SET login_tentativas_falhas = 0,
             login_bloqueio_nivel = ?,
             login_bloqueado_ate = DATE_ADD(NOW(), INTERVAL ? SECOND),
             atualizado_em = NOW()
         WHERE id = ?`,
        [FINAL_LOCK_LEVEL, lockSeconds, user.id],
      );

      return {
        ...buildLockedCredentialResult(
          { ...user, login_bloqueio_nivel: FINAL_LOCK_LEVEL },
          lockSeconds,
        ),
        message:
          "Usuario master temporariamente bloqueado por seguranca. Tente novamente em 60 segundos.",
      };
    }

    await pool.query(
      `UPDATE usuarios
       SET ativo = 0,
           login_tentativas_falhas = 0,
           login_bloqueado_ate = NULL,
           login_bloqueio_nivel = 0,
           atualizado_em = NOW()
       WHERE id = ?`,
      [user.id],
    );

    return buildAutoDisabledCredentialResult();
  }

  const durationIndex = Math.min(currentLevel, PASSWORD_LOCK_SECONDS.length - 1);
  const lockSeconds = PASSWORD_LOCK_SECONDS[durationIndex];
  const nextLevel = currentLevel + 1;

  await pool.query(
    `UPDATE usuarios
     SET login_tentativas_falhas = ?,
         login_bloqueio_nivel = ?,
         login_bloqueado_ate = DATE_ADD(NOW(), INTERVAL ? SECOND),
         atualizado_em = NOW()
     WHERE id = ?`,
    [0, nextLevel, lockSeconds, user.id],
  );

  return buildLockedCredentialResult({ ...user, login_bloqueio_nivel: nextLevel }, lockSeconds);
}

async function validateCredentials(matricula, senha) {
  const user = await findByMatricula(matricula);
  if (!user) return null;
  if (!user.ativo) return { error: "inactive" };

  const passwordMatches = await bcrypt.compare(senha, user.senha_hash || "");
  if (!passwordMatches) return registerFailedPasswordAttempt(user);

  await resetPasswordFailures(user.id);
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
       login_tentativas_falhas,
       login_bloqueado_ate,
       login_bloqueio_nivel,
       theme_preference
     FROM usuarios
     WHERE id = ?
     LIMIT 1`,
    [id],
  );
  return rows[0] || null;
}

async function hasRows(tableName, columnName, id) {
  const [rows] = await pool.query(`SELECT id FROM ${tableName} WHERE ${columnName} = ? LIMIT 1`, [
    id,
  ]);
  return rows.length > 0;
}

async function hasDeleteBlockers(id) {
  const checks = await Promise.all([
    hasRows("movimentacoes", "usuario_id", id),
    hasRows("desperdicios", "usuario_id", id),
    hasRows("kit_movimentacoes", "usuario_id", id),
    hasRows("conferencias_estoque", "usuario_id", id),
    hasRows("kits_caixa", "responsavel_atual_id", id),
  ]);

  return checks.some(Boolean);
}

async function canDelete(id) {
  const user = await findById(id);
  if (!user || user.tipo === "master") return false;
  return !(await hasDeleteBlockers(id));
}

async function remove(id) {
  await pool.query("DELETE FROM usuarios WHERE id = ?", [id]);
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
  registerFailedPasswordAttempt,
  resetPasswordFailures,
  hasDeleteBlockers,
  canDelete,
  remove,
  buildPasswordChallenge,
  getPasswordStatus,
};
