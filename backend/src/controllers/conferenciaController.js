const conferenciaService = require("../services/conferenciaService");
const { ok, created, fail } = require("../utils/response");

async function listar(_req, res) {
  try {
    const rows = await conferenciaService.listar();
    return ok(res, rows);
  } catch (e) {
    return fail(res, e.status || 500, e.message || "Erro ao listar conferencias");
  }
}

async function buscar(req, res) {
  const id = Number(req.params.id);
  if (!id) return fail(res, 400, "Conferência inválida");

  try {
    const conference = await conferenciaService.buscarCompleta(id);
    return ok(res, conference);
  } catch (e) {
    return fail(res, e.status || 500, e.message || "Erro ao carregar conferencia");
  }
}

async function criar(req, res) {
  try {
    const conference = await conferenciaService.criar({
      estoque_id: req.body?.estoque_id,
      observacao: req.body?.observacao,
      usuario: req.user,
    });
    return created(res, conference, "Conferência criada");
  } catch (e) {
    return fail(res, e.status || 500, e.message || "Erro ao criar conferencia");
  }
}

async function atualizar(req, res) {
  const id = Number(req.params.id);
  if (!id) return fail(res, 400, "Conferência inválida");

  try {
    const conference = await conferenciaService.atualizar(id, req.body || {});
    return ok(res, conference, "Conferencia salva");
  } catch (e) {
    return fail(res, e.status || 500, e.message || "Erro ao salvar conferencia");
  }
}

async function salvarItem(req, res) {
  const id = Number(req.params.id);
  if (!id) return fail(res, 400, "Conferência inválida");

  try {
    const conference = await conferenciaService.salvarItem(id, req.body || {});
    return ok(res, conference, "Item conferido");
  } catch (e) {
    return fail(
      res,
      e.status || 500,
      e.message || "Erro ao salvar item",
      e.options ? { options: e.options } : undefined,
    );
  }
}

async function removerItem(req, res) {
  const id = Number(req.params.id);
  const itemId = Number(req.params.itemId);
  if (!id || !itemId) return fail(res, 400, "Item inválido");

  try {
    await conferenciaService.removerItem(id, itemId);
    return ok(res, null, "Item removido");
  } catch (e) {
    return fail(res, e.status || 500, e.message || "Erro ao remover item");
  }
}

async function remover(req, res) {
  const id = Number(req.params.id);
  if (!id) return fail(res, 400, "Conferência inválida");

  try {
    await conferenciaService.remover(id);
    return ok(res, null, "Conferência excluída");
  } catch (e) {
    return fail(res, e.status || 500, e.message || "Erro ao excluir conferencia");
  }
}

async function finalizar(req, res) {
  const id = Number(req.params.id);
  if (!id) return fail(res, 400, "Conferência inválida");

  try {
    const conference = await conferenciaService.finalizar(id);
    return ok(res, conference, "Conferencia finalizada");
  } catch (e) {
    return fail(res, e.status || 500, e.message || "Erro ao finalizar conferencia");
  }
}

async function buscarProduto(req, res) {
  const codigo = String(req.query.codigo_barras || "").trim();
  if (!codigo) return fail(res, 400, "Código de barras obrigatório");

  try {
    const rows = await conferenciaService.buscarProdutoPorCodigo(codigo, req.query.estoque_id);
    if (!rows.length) return fail(res, 404, "Produto não encontrado");
    return ok(res, rows);
  } catch (e) {
    return fail(res, e.status || 500, e.message || "Erro ao buscar produto");
  }
}

module.exports = {
  listar,
  buscar,
  criar,
  atualizar,
  salvarItem,
  removerItem,
  remover,
  finalizar,
  buscarProduto,
};
