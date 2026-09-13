const cron = require("node-cron");
const config = require("../config");
const validityAlertService = require("./validityAlertService");

let task = null;

function stopCurrentTask() {
  if (!task) return;
  task.stop();
  task.destroy();
  task = null;
}

function cronExpressionFromTime(time) {
  const [hour, minute] = String(time || "08:00").split(":");
  return `${Number(minute)} ${Number(hour)} * * *`;
}

function reschedule() {
  stopCurrentTask();

  const horario = config.validityAlert.horario || "08:00";
  const expression = cronExpressionFromTime(horario);
  task = cron.schedule(
    expression,
    async () => {
      console.log("[VALIDADE_EMAIL] Iniciando rotina diaria de alertas");
      try {
        await validityAlertService.runDailyValidityAlert();
      } catch (error) {
        console.error("[VALIDADE_EMAIL] Falha na rotina diaria:", error.message);
      }
    },
    { scheduled: true },
  );

  console.log(`[VALIDADE_EMAIL] Alerta diario agendado para ${horario}`);
}

module.exports = { reschedule, stopCurrentTask };
