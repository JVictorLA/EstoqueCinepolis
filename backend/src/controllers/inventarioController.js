const inventarioService = require("../services/inventarioService");
const { ok, fail } = require("../utils/response");

async function estoqueAtual(req, res) {
  try {
    const rows = await inventarioService.getEstoqueAtual(req.query.estoque_id || "all");
    return ok(res, rows);
  } catch (e) {
    return fail(res, e.status || 500, e.message || "Erro ao carregar inventario");
  }
}

module.exports = {
  estoqueAtual,
};
