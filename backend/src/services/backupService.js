const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const zlib = require("zlib");
const { spawn } = require("child_process");
const { pipeline } = require("stream/promises");
const { pool } = require("../database/connection");
const config = require("../config");
const configuracaoService = require("./configuracaoService");

const BACKEND_ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_CONFIG = {
  automaticoAtivo: false,
  horario: "02:00",
  retencaoDias: 30,
  pasta: "backups",
  compactar: true,
  ultimoStatus: "",
  ultimoEm: "",
  notificarFalha: true,
};

function parseBool(value, fallback = false) {
  if (value === null || value === undefined || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "sim", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "nao", "não", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function validateHorario(value) {
  const match = String(value || "").match(/^(\d{2}):(\d{2})$/);
  if (!match) return false;
  return Number(match[1]) <= 23 && Number(match[2]) <= 59;
}

function validateBackupFolder(value) {
  const folder = String(value || DEFAULT_CONFIG.pasta)
    .trim()
    .replace(/\\/g, "/");
  if (!folder || path.isAbsolute(folder) || folder.includes("\0")) return null;

  const normalized = path.posix.normalize(folder);
  if (normalized === "." || normalized.startsWith("../") || normalized === "..") return null;
  return normalized.replace(/^.\//, "");
}

function resolveBackupDir(folder) {
  const safeFolder = validateBackupFolder(folder) || DEFAULT_CONFIG.pasta;
  const resolved = path.resolve(BACKEND_ROOT, safeFolder);
  const relative = path.relative(BACKEND_ROOT, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Pasta de backup invalida");
  }
  return resolved;
}

function timestampForFile(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return (
    [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join("-") +
    "_" +
    [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join("-")
  );
}

function publicBackup(row) {
  if (!row) return null;
  return {
    id: row.id,
    nome_arquivo: row.nome_arquivo,
    tamanho_bytes: row.tamanho_bytes,
    tipo: row.tipo,
    status: row.status,
    mensagem_erro: row.mensagem_erro,
    criado_por: row.criado_por,
    criado_por_nome: row.criado_por_nome || null,
    criado_em: row.criado_em,
  };
}

async function getBackupConfig(conn = pool) {
  const entries = await Promise.all(
    [
      "backup_automatico_ativo",
      "backup_horario",
      "backup_retencao_dias",
      "backup_pasta",
      "backup_compactar",
      "backup_ultimo_status",
      "backup_ultimo_em",
      "backup_notificar_falha",
    ].map(async (key) => [key, await configuracaoService.getConfig(key, conn)]),
  );
  const values = Object.fromEntries(entries);
  const folder = validateBackupFolder(values.backup_pasta) || DEFAULT_CONFIG.pasta;
  const horario = validateHorario(values.backup_horario)
    ? values.backup_horario
    : DEFAULT_CONFIG.horario;

  return {
    backup_automatico_ativo: parseBool(
      values.backup_automatico_ativo,
      DEFAULT_CONFIG.automaticoAtivo,
    ),
    backup_horario: horario,
    backup_retencao_dias: parsePositiveInt(
      values.backup_retencao_dias,
      DEFAULT_CONFIG.retencaoDias,
    ),
    backup_pasta: folder,
    backup_compactar: parseBool(values.backup_compactar, DEFAULT_CONFIG.compactar),
    backup_ultimo_status: values.backup_ultimo_status || DEFAULT_CONFIG.ultimoStatus,
    backup_ultimo_em: values.backup_ultimo_em || DEFAULT_CONFIG.ultimoEm,
    backup_notificar_falha: parseBool(values.backup_notificar_falha, DEFAULT_CONFIG.notificarFalha),
  };
}

async function updateBackupConfig(payload, userId) {
  const horario = String(payload?.backup_horario || DEFAULT_CONFIG.horario).trim();
  if (!validateHorario(horario)) {
    const error = new Error("Horario de backup invalido. Use HH:mm.");
    error.status = 400;
    throw error;
  }

  const folder = validateBackupFolder(payload?.backup_pasta);
  if (!folder) {
    const error = new Error("Pasta de backup invalida");
    error.status = 400;
    throw error;
  }

  const retencaoDias = parsePositiveInt(payload?.backup_retencao_dias, 0);
  if (!retencaoDias) {
    const error = new Error("Retencao deve ser maior que zero");
    error.status = 400;
    throw error;
  }

  await configuracaoService.setManyConfigs(
    [
      {
        chave: "backup_automatico_ativo",
        valor: !!payload.backup_automatico_ativo,
        categoria: "backup",
        nivelAcesso: "master",
      },
      {
        chave: "backup_horario",
        valor: horario,
        categoria: "backup",
        nivelAcesso: "master",
      },
      {
        chave: "backup_retencao_dias",
        valor: retencaoDias,
        categoria: "backup",
        nivelAcesso: "master",
      },
      {
        chave: "backup_pasta",
        valor: folder,
        categoria: "backup",
        nivelAcesso: "master",
      },
      {
        chave: "backup_compactar",
        valor: !!payload.backup_compactar,
        categoria: "backup",
        nivelAcesso: "master",
      },
      {
        chave: "backup_notificar_falha",
        valor: !!payload.backup_notificar_falha,
        categoria: "backup",
        nivelAcesso: "master",
      },
    ],
    userId || null,
  );

  return getBackupConfig();
}

async function setLastStatus(status, conn = pool) {
  await configuracaoService.setManyConfigs(
    [
      { chave: "backup_ultimo_status", valor: status, categoria: "backup", nivelAcesso: "master" },
      {
        chave: "backup_ultimo_em",
        valor: new Date().toISOString(),
        categoria: "backup",
        nivelAcesso: "master",
      },
    ],
    null,
    conn,
  );
}

async function insertBackupRecord(data, conn = pool) {
  const [result] = await conn.query(
    `INSERT INTO backups
      (nome_arquivo, caminho_arquivo, tamanho_bytes, tipo, status, mensagem_erro, criado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.nomeArquivo,
      data.caminhoArquivo,
      data.tamanhoBytes ?? null,
      data.tipo,
      data.status,
      data.mensagemErro ?? null,
      data.criadoPor ?? null,
    ],
  );
  return result.insertId;
}

async function runMysqlDump(outputPath, compactar) {
  const args = [
    "--single-transaction",
    "--routines",
    "--triggers",
    "--events",
    "-h",
    config.db.host,
    "-P",
    String(config.db.port),
    "-u",
    config.db.user,
    config.db.database,
  ];

  const child = spawn("mysqldump", args, {
    shell: false,
    env: {
      ...process.env,
      MYSQL_PWD: config.db.password || "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  const output = fs.createWriteStream(outputPath);
  const source = compactar ? child.stdout.pipe(zlib.createGzip()) : child.stdout;
  const pipePromise = pipeline(source, output);

  const exitPromise = new Promise((resolve, reject) => {
    child.on("error", () => reject(new Error("mysqldump nao encontrado ou falhou")));
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || "mysqldump nao encontrado ou falhou"));
    });
  });

  await Promise.all([pipePromise, exitPromise]);
}

async function createBackup(tipo = "manual", criadoPor = null) {
  const backupConfig = await getBackupConfig();
  const backupDir = resolveBackupDir(backupConfig.backup_pasta);
  await fsp.mkdir(backupDir, { recursive: true });

  const extension = backupConfig.backup_compactar ? ".sql.gz" : ".sql";
  const nomeArquivo = `zytrex_backup_${timestampForFile()}${extension}`;
  const outputPath = path.join(backupDir, nomeArquivo);
  const relativePath = path.relative(BACKEND_ROOT, outputPath);

  try {
    await runMysqlDump(outputPath, backupConfig.backup_compactar);
    const stats = await fsp.stat(outputPath);
    if (!stats.size) throw new Error("Arquivo de backup gerado vazio");

    const id = await insertBackupRecord({
      nomeArquivo,
      caminhoArquivo: relativePath,
      tamanhoBytes: stats.size,
      tipo,
      status: "sucesso",
      criadoPor,
    });
    await setLastStatus("sucesso");
    return publicBackup({
      id,
      nome_arquivo: nomeArquivo,
      tamanho_bytes: stats.size,
      tipo,
      status: "sucesso",
      mensagem_erro: null,
      criado_por: criadoPor,
      criado_em: new Date().toISOString(),
    });
  } catch (error) {
    await fsp.rm(outputPath, { force: true }).catch(() => {});
    const message = error.message || "mysqldump nao encontrado ou falhou";
    const id = await insertBackupRecord({
      nomeArquivo,
      caminhoArquivo: relativePath,
      tamanhoBytes: null,
      tipo,
      status: "falha",
      mensagemErro: message,
      criadoPor,
    });
    await setLastStatus("falha");
    const httpError = new Error(message);
    httpError.status = 500;
    httpError.backup = publicBackup({
      id,
      nome_arquivo: nomeArquivo,
      tamanho_bytes: null,
      tipo,
      status: "falha",
      mensagem_erro: message,
      criado_por: criadoPor,
      criado_em: new Date().toISOString(),
    });
    throw httpError;
  }
}

async function listBackups() {
  const [rows] = await pool.query(
    `SELECT b.id, b.nome_arquivo, b.tamanho_bytes, b.tipo, b.status, b.mensagem_erro,
            b.criado_por, b.criado_em, u.nome AS criado_por_nome
     FROM backups b
     LEFT JOIN usuarios u ON u.id = b.criado_por
     ORDER BY b.criado_em DESC, b.id DESC`,
  );
  return rows.map(publicBackup);
}

async function getLatestBackup() {
  const [rows] = await pool.query(
    `SELECT b.id, b.nome_arquivo, b.tamanho_bytes, b.tipo, b.status, b.mensagem_erro,
            b.criado_por, b.criado_em, u.nome AS criado_por_nome
     FROM backups b
     LEFT JOIN usuarios u ON u.id = b.criado_por
     ORDER BY b.criado_em DESC, b.id DESC
     LIMIT 1`,
  );
  return publicBackup(rows[0]);
}

function resolveStoredBackupPath(row) {
  const stored = String(row.caminho_arquivo || "");
  const resolved = path.isAbsolute(stored)
    ? path.resolve(stored)
    : path.resolve(BACKEND_ROOT, stored);
  const relative = path.relative(BACKEND_ROOT, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    const error = new Error("Caminho de backup invalido");
    error.status = 403;
    throw error;
  }
  if (path.basename(resolved) !== row.nome_arquivo) {
    const error = new Error("Arquivo de backup invalido");
    error.status = 403;
    throw error;
  }
  return resolved;
}

async function getBackupFile(id) {
  const [rows] = await pool.query("SELECT * FROM backups WHERE id = ? LIMIT 1", [id]);
  if (!rows.length) {
    const error = new Error("Backup nao encontrado");
    error.status = 404;
    throw error;
  }
  const row = rows[0];
  if (row.status !== "sucesso") {
    const error = new Error("Backup sem arquivo disponivel para download");
    error.status = 400;
    throw error;
  }

  const filePath = resolveStoredBackupPath(row);
  await fsp.access(filePath, fs.constants.R_OK).catch(() => {
    const error = new Error("Arquivo de backup nao encontrado no servidor");
    error.status = 404;
    throw error;
  });
  return { filePath, fileName: row.nome_arquivo };
}

async function deleteBackup(id) {
  const [rows] = await pool.query("SELECT * FROM backups WHERE id = ? LIMIT 1", [id]);
  if (!rows.length) {
    const error = new Error("Backup nao encontrado");
    error.status = 404;
    throw error;
  }

  const row = rows[0];
  let fileRemoved = false;
  if (row.status === "sucesso") {
    const filePath = resolveStoredBackupPath(row);
    await fsp.rm(filePath, { force: true }).then(() => {
      fileRemoved = true;
    });
  }
  await pool.query("DELETE FROM backups WHERE id = ?", [id]);
  return { fileRemoved };
}

async function applyRetention(retencaoDias) {
  const days = parsePositiveInt(retencaoDias, DEFAULT_CONFIG.retencaoDias);
  const [rows] = await pool.query(
    "SELECT * FROM backups WHERE criado_em < DATE_SUB(NOW(), INTERVAL ? DAY)",
    [days],
  );

  for (const row of rows) {
    try {
      if (row.status === "sucesso") {
        const filePath = resolveStoredBackupPath(row);
        await fsp.rm(filePath, { force: true });
      }
      await pool.query("DELETE FROM backups WHERE id = ?", [row.id]);
      console.log(`[BACKUP] Retencao removeu backup ${row.nome_arquivo}`);
    } catch (error) {
      console.error(`[BACKUP] Falha ao aplicar retencao no backup ${row.id}:`, error.message);
    }
  }
}

module.exports = {
  createBackup,
  listBackups,
  getLatestBackup,
  getBackupConfig,
  updateBackupConfig,
  getBackupFile,
  deleteBackup,
  applyRetention,
  validateHorario,
};
