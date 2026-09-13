const backupService = require("../services/backupService");
const backupScheduler = require("../services/backupScheduler");
const { ok, fail } = require("../utils/response");

async function listar(_req, res) {
  const [backups, config, ultimo] = await Promise.all([
    backupService.listBackups(),
    backupService.getBackupConfig(),
    backupService.getLatestBackup(),
  ]);
  return ok(res, { backups, config, ultimo });
}

async function executarManual(req, res) {
  try {
    const backup = await backupService.createBackup("manual", req.user?.id || null);
    return ok(res, backup, "Backup gerado com sucesso", 201);
  } catch (error) {
    if (error.backup) {
      return fail(res, error.status || 500, error.message, error.backup);
    }
    throw error;
  }
}

async function download(req, res) {
  const { filePath, fileName } = await backupService.getBackupFile(req.params.id);
  return res.download(filePath, fileName);
}

async function remover(req, res) {
  const result = await backupService.deleteBackup(req.params.id);
  return ok(res, result, result.fileRemoved ? "Backup excluido" : "Historico de backup excluido");
}

async function buscarConfig(_req, res) {
  const config = await backupService.getBackupConfig();
  return ok(res, config);
}

async function atualizarConfig(req, res) {
  const config = await backupService.updateBackupConfig(req.body || {}, req.user?.id || null);
  await backupScheduler.reschedule();
  return ok(res, config, "Configuracoes de backup atualizadas");
}

module.exports = {
  listar,
  executarManual,
  download,
  remover,
  buscarConfig,
  atualizarConfig,
};
