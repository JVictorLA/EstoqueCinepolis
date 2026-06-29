const maintenanceService = require("../services/maintenanceService");
const { ok } = require("../utils/response");

async function operacional(_req, res) {
  const status = await maintenanceService.getOperationalStatus();
  return ok(res, status);
}

module.exports = { operacional };
