const configuracaoService = require("./configuracaoService");

const MAINTENANCE_MESSAGE =
  "Sistema em modo manutenção. Operações do modo operador estão temporariamente bloqueadas.";

function parseBooleanConfig(value, fallback = false) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "sim", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "nao", "não", "no", "off"].includes(normalized)) return false;
  return fallback;
}

async function isMaintenanceMode(conn) {
  const value = await configuracaoService.getConfig("modo_manutencao", conn);
  return parseBooleanConfig(value, false);
}

function buildMaintenanceBlockError() {
  return Object.assign(new Error(MAINTENANCE_MESSAGE), {
    status: 403,
    modo_manutencao: true,
  });
}

async function assertOperationalAllowed(usuario, conn) {
  if (usuario?.tipo !== "operador") return;
  if (await isMaintenanceMode(conn)) {
    throw buildMaintenanceBlockError();
  }
}

async function getOperationalStatus(conn) {
  const modoManutencao = await isMaintenanceMode(conn);
  return {
    modo_manutencao: modoManutencao,
    mensagem: modoManutencao ? MAINTENANCE_MESSAGE : undefined,
  };
}

module.exports = {
  MAINTENANCE_MESSAGE,
  assertOperationalAllowed,
  buildMaintenanceBlockError,
  getOperationalStatus,
  isMaintenanceMode,
};
