const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { pool } = require("../database/connection");
const configuracaoService = require("./configuracaoService");

/**
 * Tabela `usuarios`:
 *   id, matricula, nome, email, senha_hash, tipo, ativo, arquivado, arquivado_em, criado_em,
 *   atualizado_em, senha_atualizada_em, theme_preference
 */

const PUBLIC_FIELDS =
  "id, matricula, nome, email, tipo, ativo, arquivado, arquivado_em, criado_em, atualizado_em, senha_atualizada_em, precisa_trocar_senha, theme_preference";
const PASSWORD_MAX_AGE_DAYS = 14;
const PASSWORD_WARNING_DAYS = [7, 3];
const MAX_FAILED_PASSWORD_ATTEMPTS = 5;
const FAILED_ATTEMPTS_AFTER_LOCK = 3;
const PASSWORD_LOCK_SECONDS = [15, 30, 60];
const FINAL_LOCK_LEVEL = PASSWORD_LOCK_SECONDS.length;
const MASTER_RECOVERY_MAX_FAILED_ATTEMPTS = 5;
const MASTER_RECOVERY_LOCK_SECONDS = 300;
const AUTO_DISABLE_MESSAGE =
  "Usuario desabilitado por seguranca. Procure um administrador ou o tecnico de TI para desbloquear e recuperar sua senha.";
const MASTER_RECOVERY_KEYS = {
  hash: "master_recovery_key_hash",
  createdAt: "master_recovery_key_created_at",
  failedAttempts: "master_recovery_failed_attempts",
  blockedUntil: "master_recovery_bloqueado_ate",
};

function getTemporaryPassword() {
  if (!process.env.DEFAULT_TEMPORARY_PASSWORD) {
    throw new Error(
      "DEFAULT_TEMPORARY_PASSWORD is required to create or reset temporary passwords",
    );
  }
  return process.env.DEFAULT_TEMPORARY_PASSWORD;
}

function passwordMatchesMatricula(matricula, senha) {
  return String(matricula || "").trim() === String(senha || "").trim();
}

function assertPasswordDiffersFromMatricula(matricula, senha) {
  if (passwordMatchesMatricula(matricula, senha)) {
    throw Object.assign(new Error("A senha deve ser diferente da matricula"), { status: 400 });
  }
}

function assertValidFinalPassword(matricula, senha) {
  if (!senha || String(senha).length < 6) {
    throw Object.assign(new Error("A senha deve ter pelo menos 6 caracteres"), { status: 400 });
  }
  assertPasswordDiffersFromMatricula(matricula, senha);
}

function generateRecoveryKeyValue() {
  return crypto.randomBytes(24).toString("hex").match(/.{1,6}/g).join("-");
}

function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getPasswordAgeInfo(user) {
  const passwordUpdatedAt = parseDate(user.senha_atualizada_em) || parseDate(user.criado_em);
  if (!passwordUpdatedAt) return null;
  const diffMs = Date.now() - passwordUpdatedAt.getTime();
  const ageDays = diffMs / (24 * 60 * 60 * 1000);
  const daysRemaining = Math.ceil(PASSWORD_MAX_AGE_DAYS - ageDays);
  return {
    ageDays,
    daysRemaining: Math.max(0, daysRemaining),
    expiresAt: new Date(passwordUpdatedAt.getTime() + PASSWORD_MAX_AGE_DAYS * 24 * 60 * 60 * 1000),
  };
}

function isPasswordExpired(user) {
  const info = getPasswordAgeInfo(user);
  if (!info) return false;
  return info.ageDays >= PASSWORD_MAX_AGE_DAYS;
}

function getPasswordStatus(user) {
  if (user.precisa_trocar_senha) return "first_access";
  if (isPasswordExpired(user)) return "expired";
  return null;
}

function getPasswordWarning(user) {
  if (getPasswordStatus(user)) return null;
  const info = getPasswordAgeInfo(user);
  if (!info) return null;
  const maxWarningDays = Math.max(...PASSWORD_WARNING_DAYS);
  if (info.daysRemaining <= 0 || info.daysRemaining > maxWarningDays) return null;
  return {
    type: "expiring",
    days_remaining: info.daysRemaining,
    threshold_days: info.daysRemaining <= 3 ? 3 : 7,
    expires_at: info.expiresAt.toISOString(),
    message: `Sua senha vence em ${info.daysRemaining} dia${info.daysRemaining === 1 ? "" : "s"}. Deseja trocar agora?`,
  };
}

function getLockRemainingSeconds(user) {
  const lockedUntil = parseDate(user.login_bloqueado_ate);
  if (!lockedUntil) return 0;
  return Math.max(0, Math.ceil((lockedUntil.getTime() - Date.now()) / 1000));
}

function getDateRemainingSeconds(value) {
  const date = parseDate(value);
  if (!date) return 0;
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / 1000));
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
  const passwordWarning = getPasswordWarning(user);
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
    password_warning: passwordWarning,
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
    `SELECT ${PUBLIC_FIELDS} FROM usuarios ${where} ORDER BY arquivado ASC, ativo DESC, nome ASC`,
  );
  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      can_delete: await canDelete(row.id),
    })),
  );
}

async function listForScaleSync({ atualizadoDesde = null } = {}) {
  const where = [];
  const params = [];

  if (atualizadoDesde) {
    where.push("atualizado_em >= ?");
    params.push(atualizadoDesde);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [rows] = await pool.query(
    `SELECT id, nome, matricula, tipo, ativo, atualizado_em
       FROM usuarios
       ${whereClause}
      ORDER BY atualizado_em ASC, id ASC`,
    params,
  );

  return rows.map((row) => ({
    id: row.id,
    nome: row.nome,
    matricula: row.matricula,
    tipo: row.tipo,
    ativo: !!row.ativo,
    atualizado_em: row.atualizado_em,
  }));
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
  const rawPassword = senha || getTemporaryPassword();
  assertPasswordDiffersFromMatricula(matricula, rawPassword);
  const senha_hash = await bcrypt.hash(rawPassword, 10);

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
  assertPasswordDiffersFromMatricula(matricula, senha);
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
    let targetMatricula = matricula;
    if (targetMatricula === undefined) {
      const [rows] = await pool.query("SELECT matricula FROM usuarios WHERE id = ? LIMIT 1", [id]);
      targetMatricula = rows[0]?.matricula;
    }
    assertPasswordDiffersFromMatricula(targetMatricula, senha);

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

async function archiveUser(id) {
  await pool.query(
    `UPDATE usuarios
     SET arquivado = 1,
         arquivado_em = NOW(),
         ativo = 0,
         atualizado_em = NOW()
     WHERE id = ?`,
    [id],
  );
  return findById(id);
}

async function restoreUser(id) {
  await pool.query(
    `UPDATE usuarios
     SET arquivado = 0,
         arquivado_em = NULL,
         ativo = 0,
         atualizado_em = NOW()
     WHERE id = ?`,
    [id],
  );
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

async function generateMasterRecoveryKey(masterUserId, conn = pool) {
  const recoveryKey = generateRecoveryKeyValue();
  const recoveryKeyHash = await bcrypt.hash(recoveryKey, 10);
  const createdAt = new Date().toISOString();

  await configuracaoService.setManyConfigs(
    [
      {
        chave: MASTER_RECOVERY_KEYS.hash,
        valor: recoveryKeyHash,
        categoria: "seguranca",
        nivelAcesso: "master",
        tipo: "string",
      },
      {
        chave: MASTER_RECOVERY_KEYS.createdAt,
        valor: createdAt,
        categoria: "seguranca",
        nivelAcesso: "master",
        tipo: "string",
      },
      {
        chave: MASTER_RECOVERY_KEYS.failedAttempts,
        valor: 0,
        categoria: "seguranca",
        nivelAcesso: "master",
        tipo: "number",
      },
      {
        chave: MASTER_RECOVERY_KEYS.blockedUntil,
        valor: "",
        categoria: "seguranca",
        nivelAcesso: "master",
        tipo: "string",
      },
    ],
    masterUserId,
    conn,
  );

  return {
    recoveryKey,
    recoveryKeyCreatedAt: createdAt,
  };
}

async function getMasterRecoveryState(conn = pool) {
  const entries = await Promise.all(
    Object.entries(MASTER_RECOVERY_KEYS).map(async ([name, key]) => [
      name,
      await configuracaoService.getConfig(key, conn),
    ]),
  );
  return Object.fromEntries(entries);
}

async function setMasterRecoveryAttemptState({ failedAttempts, blockedUntil }, conn = pool) {
  await configuracaoService.setManyConfigs(
    [
      {
        chave: MASTER_RECOVERY_KEYS.failedAttempts,
        valor: failedAttempts,
        categoria: "seguranca",
        nivelAcesso: "master",
        tipo: "number",
      },
      {
        chave: MASTER_RECOVERY_KEYS.blockedUntil,
        valor: blockedUntil || "",
        categoria: "seguranca",
        nivelAcesso: "master",
        tipo: "string",
      },
    ],
    null,
    conn,
  );
}

async function recoverMasterPassword({ matricula, recoveryKey, novaSenha, confirmarSenha }) {
  const cleanMatricula = String(matricula || "").trim();
  const cleanRecoveryKey = String(recoveryKey || "").trim();
  const password = String(novaSenha || "");
  const confirmation = String(confirmarSenha || "");

  if (!cleanMatricula || !cleanRecoveryKey || !password || !confirmation) {
    throw Object.assign(new Error("Informe matricula, chave de recuperação e nova senha"), {
      status: 400,
    });
  }
  if (password !== confirmation) {
    throw Object.assign(new Error("As senhas não coincidem"), { status: 400 });
  }

  const user = await findByMatricula(cleanMatricula);
  if (!user || user.tipo !== "master") {
    throw Object.assign(new Error("Recuperação disponível apenas para o usuário master"), {
      status: 403,
    });
  }
  assertValidFinalPassword(user.matricula, password);

  const state = await getMasterRecoveryState();
  if (!state.hash) {
    throw Object.assign(new Error("Chave de recuperação do master não foi gerada"), {
      status: 404,
    });
  }

  const retryAfterSeconds = getDateRemainingSeconds(state.blockedUntil);
  if (retryAfterSeconds > 0) {
    const error = new Error(
      `Recuperação temporariamente bloqueada. Tente novamente em ${retryAfterSeconds} segundos.`,
    );
    error.status = 403;
    error.data = {
      recuperacao_master_bloqueada: true,
      retry_after_seconds: retryAfterSeconds,
    };
    throw error;
  }

  const matches = await bcrypt.compare(cleanRecoveryKey, state.hash);
  if (!matches) {
    const nextAttempts = Number(state.failedAttempts || 0) + 1;
    if (nextAttempts >= MASTER_RECOVERY_MAX_FAILED_ATTEMPTS) {
      const blockedUntil = new Date(Date.now() + MASTER_RECOVERY_LOCK_SECONDS * 1000).toISOString();
      await setMasterRecoveryAttemptState({ failedAttempts: 0, blockedUntil });
      const error = new Error(
        `Muitas tentativas inválidas. Tente novamente em ${MASTER_RECOVERY_LOCK_SECONDS} segundos.`,
      );
      error.status = 403;
      error.data = {
        recuperacao_master_bloqueada: true,
        retry_after_seconds: MASTER_RECOVERY_LOCK_SECONDS,
      };
      throw error;
    }

    await setMasterRecoveryAttemptState({ failedAttempts: nextAttempts, blockedUntil: "" });
    throw Object.assign(new Error("Chave de recuperação inválida"), { status: 401 });
  }

  await update(user.id, { senha: password });
  await resetPasswordFailures(user.id);
  const nextRecovery = await generateMasterRecoveryKey(user.id);

  return {
    usuario: await findById(user.id),
    recoveryKey: nextRecovery.recoveryKey,
    recoveryKeyCreatedAt: nextRecovery.recoveryKeyCreatedAt,
  };
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
  listForScaleSync,
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
  archiveUser,
  restoreUser,
  validateCredentials,
  resetPassword,
  generateMasterRecoveryKey,
  recoverMasterPassword,
  registerFailedPasswordAttempt,
  resetPasswordFailures,
  hasDeleteBlockers,
  canDelete,
  remove,
  buildPasswordChallenge,
  getPasswordStatus,
};
