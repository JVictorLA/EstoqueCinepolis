const produtoService = require("../services/produtoService");
const estoqueService = require("../services/estoqueService");
const { ok, created, fail } = require("../utils/response");

async function listar(req, res) {
  const rows = await produtoService.listAll(req.query.estoque_id);
  return ok(res, rows);
}

async function buscarPorCodigo(req, res) {
  const { codigo_barras } = req.params;
  if (!codigo_barras) return fail(res, 400, "Codigo de barras obrigatorio");
  const p = await produtoService.findByBarcode(codigo_barras, req.query.estoque_id);
  if (!p) return fail(res, 404, "Produto nao encontrado");
  return ok(res, p);
}

async function criar(req, res) {
  const {
    codigo_barras,
    nome,
    categoria_id,
    unidade,
    preco_venda,
    estoque_id,
    estoque_atual,
    estoque_minimo,
    ativo,
  } = req.body || {};

  if (!codigo_barras || !nome) {
    return fail(res, 400, "codigo_barras e nome sao obrigatorios");
  }
  if (categoria_id == null) {
    return fail(res, 400, "categoria_id e obrigatorio");
  }
  if (preco_venda == null || isNaN(Number(preco_venda))) {
    return fail(res, 400, "preco_venda invalido");
  }
  if (!Number(estoque_id)) {
    return fail(res, 400, "estoque_id e obrigatorio");
  }
  if (!(await estoqueService.findById(Number(estoque_id)))) {
    return fail(res, 404, "Estoque nao encontrado");
  }

  try {
    const novo = await produtoService.create({
      codigo_barras: String(codigo_barras).trim(),
      nome: String(nome).trim(),
      categoria_id: Number(categoria_id),
      unidade: unidade ? String(unidade).trim() : "un",
      preco_venda: Number(preco_venda),
      estoque_id: Number(estoque_id),
      estoque_atual: estoque_atual != null ? Number(estoque_atual) : 0,
      estoque_minimo: estoque_minimo != null ? Number(estoque_minimo) : 0,
      ativo: ativo === undefined ? true : !!ativo,
    });

    return created(res, novo, "Produto cadastrado");
  } catch (e) {
    return fail(res, e.status || 500, e.message || "Erro ao cadastrar produto");
  }
}

async function atualizar(req, res) {
  const id = Number(req.params.id);
  const {
    codigo_barras,
    nome,
    categoria_id,
    unidade,
    preco_venda,
    ativo,
  } = req.body || {};

  if (!id) {
    return fail(res, 400, "Produto invalido");
  }
  if (!codigo_barras || !nome) {
    return fail(res, 400, "codigo_barras e nome sao obrigatorios");
  }
  if (categoria_id == null) {
    return fail(res, 400, "categoria_id e obrigatorio");
  }
  if (preco_venda == null || isNaN(Number(preco_venda))) {
    return fail(res, 400, "preco_venda invalido");
  }

  try {
    const produto = await produtoService.update(id, {
      codigo_barras: String(codigo_barras).trim(),
      nome: String(nome).trim(),
      categoria_id: Number(categoria_id),
      unidade: unidade ? String(unidade).trim() : "un",
      preco_venda: Number(preco_venda),
      ativo: ativo === undefined ? undefined : !!ativo,
    });
    return ok(res, produto, "Produto atualizado");
  } catch (e) {
    return fail(res, e.status || 500, e.message || "Erro ao atualizar produto");
  }
}

async function alterarStatus(req, res) {
  const id = Number(req.params.id);
  const { ativo } = req.body || {};

  if (!id) {
    return fail(res, 400, "Produto invalido");
  }
  if (ativo === undefined) {
    return fail(res, 400, "Informe ativo");
  }

  try {
    const produto = await produtoService.setStatus(id, !!ativo);
    return ok(res, produto, "Produto atualizado");
  } catch (e) {
    return fail(res, e.status || 500, e.message || "Erro ao atualizar produto");
  }
}

async function remover(req, res) {
  const id = Number(req.params.id);

  if (!id) {
    return fail(res, 400, "Produto invalido");
  }

  try {
    await produtoService.remove(id);
    return ok(res, null, "Produto excluido");
  } catch (e) {
    return fail(res, e.status || 500, e.message || "Erro ao excluir produto");
  }
}

module.exports = { listar, buscarPorCodigo, criar, atualizar, alterarStatus, remover };
