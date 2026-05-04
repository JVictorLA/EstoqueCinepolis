const app = require("./app");
const config = require("./config");
const { testConnection } = require("./database/connection");

(async () => {
  try {
    await testConnection();
    // eslint-disable-next-line no-console
    console.log(
      `[DB] Conectado em ${config.db.host}:${config.db.port}/${config.db.database}`
    );
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[DB] Falha ao conectar:", e.message);
    process.exit(1);
  }

  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[HTTP] API escutando em http://localhost:${config.port}`);
  });
})();
