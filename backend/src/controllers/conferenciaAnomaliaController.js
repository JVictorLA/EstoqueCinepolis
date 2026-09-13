const conferenciaAnomaliaService = require("../services/conferenciaAnomaliaService");
const { ok, fail } = require("../utils/response");

async function listar(req, res) {
  try {
    const rows = await conferenciaAnomaliaService.list(req.query || {});
    return ok(res, rows);
  } catch (e) {
    return fail(res, e.status || 500, e.message || "Erro ao listar anomalias");
  }
}

async function resumo(req, res) {
  try {
    const summary = await conferenciaAnomaliaService.getSummary(req.query || {});
    return ok(res, summary);
  } catch (e) {
    return fail(res, e.status || 500, e.message || "Erro ao resumir anomalias");
  }
}

async function historico(req, res) {
  const id = Number(req.params.id);
  if (!id) return fail(res, 400, "Anomalia invalida");

  try {
    const rows = await conferenciaAnomaliaService.getHistory(id);
    return ok(res, rows);
  } catch (e) {
    return fail(res, e.status || 500, e.message || "Erro ao carregar historico da anomalia");
  }
}

async function atualizarStatus(req, res) {
  const id = Number(req.params.id);
  if (!id) return fail(res, 400, "Anomalia invalida");

  try {
    const anomaly = await conferenciaAnomaliaService.updateStatus(id, req.body || {}, req.user?.id);
    return ok(res, anomaly, "Anomalia atualizada");
  } catch (e) {
    return fail(res, e.status || 500, e.message || "Erro ao atualizar anomalia");
  }
}

module.exports = {
  listar,
  resumo,
  historico,
  atualizarStatus,
};
