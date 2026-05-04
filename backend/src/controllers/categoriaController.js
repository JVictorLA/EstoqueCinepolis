const categoriaService = require("../services/categoriaService");
const { ok } = require("../utils/response");

async function listar(_req, res) {
  return ok(res, await categoriaService.listAll());
}

module.exports = { listar };
