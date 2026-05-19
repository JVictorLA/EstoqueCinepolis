const categoriaService = require("../services/categoriaService");
const { created, fail, ok } = require("../utils/response");

async function listar(_req, res) {
  return ok(res, await categoriaService.listAll());
}

async function criar(req, res) {
  const { nome, exige_validade } = req.body;

  if (!nome || !nome.trim()) {
    return fail(res, 400, "Nome da categoria e obrigatorio");
  }

  try {
    const categoria = await categoriaService.create({ nome, exige_validade: !!exige_validade });
    return created(res, categoria, "Categoria criada com sucesso");
  } catch (e) {
    return fail(res, e.status || 500, e.message || "Erro ao criar categoria");
  }
}

async function atualizar(req, res) {
  const id = Number(req.params.id);
  const { nome, exige_validade } = req.body;

  if (!id) {
    return fail(res, 400, "Categoria invalida");
  }

  if (!nome || !nome.trim()) {
    return fail(res, 400, "Nome da categoria e obrigatorio");
  }

  try {
    const categoria = await categoriaService.update(id, { nome, exige_validade: !!exige_validade });
    return ok(res, categoria, "Categoria atualizada com sucesso");
  } catch (e) {
    return fail(res, e.status || 500, e.message || "Erro ao atualizar categoria");
  }
}

async function remover(req, res) {
  const id = Number(req.params.id);

  if (!id) {
    return fail(res, 400, "Categoria invalida");
  }

  try {
    await categoriaService.remove(id);
    return ok(res, null, "Categoria excluida com sucesso");
  } catch (e) {
    return fail(res, e.status || 500, e.message || "Erro ao excluir categoria");
  }
}

module.exports = { listar, criar, atualizar, remover };
