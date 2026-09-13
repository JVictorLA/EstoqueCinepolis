const app = require("./app");
const config = require("./config");
const { testConnection } = require("./database/connection");
const { ensureDatabaseSchema } = require("./database/ensureSchema");
const backupScheduler = require("./services/backupScheduler");
const validityAlertScheduler = require("./services/validityAlertScheduler");

(async () => {
  try {
    await testConnection();
    await ensureDatabaseSchema();
    await backupScheduler.reschedule();
    validityAlertScheduler.reschedule();
    console.log(`[DB] Conectado em ${config.db.host}:${config.db.port}/${config.db.database}`);
  } catch (e) {
    console.error("[DB] Falha ao conectar:", e.message);
    process.exit(1);
  }

  app.listen(config.port, () => {
    console.log(`[HTTP] API escutando em http://localhost:${config.port}`);
  });
})();
