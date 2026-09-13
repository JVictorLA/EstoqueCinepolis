const cron = require("node-cron");
const backupService = require("./backupService");

let task = null;

function stopCurrentTask() {
  if (!task) return;
  task.stop();
  task.destroy();
  task = null;
}

function cronExpressionFromTime(time) {
  const [hour, minute] = String(time || "02:00").split(":");
  return `${Number(minute)} ${Number(hour)} * * *`;
}

async function reschedule() {
  stopCurrentTask();

  const config = await backupService.getBackupConfig();
  if (!config.backup_automatico_ativo) {
    console.log("[BACKUP] Backup automatico desativado");
    return;
  }

  const expression = cronExpressionFromTime(config.backup_horario);
  task = cron.schedule(
    expression,
    async () => {
      console.log("[BACKUP] Iniciando backup automatico");
      try {
        await backupService.createBackup("automatico", null);
        await backupService.applyRetention(config.backup_retencao_dias);
        console.log("[BACKUP] Backup automatico concluido");
      } catch (error) {
        console.error("[BACKUP] Falha no backup automatico:", error.message);
      }
    },
    { scheduled: true },
  );

  console.log(`[BACKUP] Backup automatico agendado para ${config.backup_horario}`);
}

module.exports = { reschedule, stopCurrentTask };
