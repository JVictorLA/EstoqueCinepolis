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
  p.lotes = await produtoService.listLotes(p.id, req.query.estoque_id);
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
    data_validade,
    lote,
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
      data_validade,
      lote,
      ativo: ativo === undefined ? true : !!ativo,
    });

    return created(res, novo, "Produto cadastrado");
  } catch (e) {
    return fail(res, e.status || 500, e.message || "Erro ao cadastrar produto");
  }
}

function normalizeProductPayload(raw, index) {
  const label = `Linha ${index + 1}`;
  const {
    codigo_barras,
    nome,
    categoria_id,
    unidade,
    preco_venda,
    estoque_id,
    estoque_atual,
    estoque_minimo,
    data_validade,
    lote,
    ativo,
  } = raw || {};

  if (!codigo_barras || !String(codigo_barras).trim()) {
    throw Object.assign(new Error(`${label}: codigo_barras e obrigatorio`), { status: 400 });
  }
  if (!nome || !String(nome).trim()) {
    throw Object.assign(new Error(`${label}: nome e obrigatorio`), { status: 400 });
  }
  if (categoria_id == null || !Number(categoria_id)) {
    throw Object.assign(new Error(`${label}: categoria_id e obrigatorio`), { status: 400 });
  }
  if (preco_venda == null || isNaN(Number(preco_venda)) || Number(preco_venda) < 0) {
    throw Object.assign(new Error(`${label}: preco_venda invalido`), { status: 400 });
  }
  if (!Number(estoque_id)) {
    throw Object.assign(new Error(`${label}: estoque_id e obrigatorio`), { status: 400 });
  }
  if (estoque_atual != null && (isNaN(Number(estoque_atual)) || Number(estoque_atual) < 0)) {
    throw Object.assign(new Error(`${label}: estoque_atual invalido`), { status: 400 });
  }
  if (estoque_minimo != null && (isNaN(Number(estoque_minimo)) || Number(estoque_minimo) < 0)) {
    throw Object.assign(new Error(`${label}: estoque_minimo invalido`), { status: 400 });
  }

  return {
    codigo_barras: String(codigo_barras).trim(),
    nome: String(nome).trim(),
    categoria_id: Number(categoria_id),
    unidade: unidade ? String(unidade).trim() : "un",
    preco_venda: Number(preco_venda),
    estoque_id: Number(estoque_id),
    estoque_atual: estoque_atual != null ? Number(estoque_atual) : 0,
    estoque_minimo: estoque_minimo != null ? Number(estoque_minimo) : 0,
    data_validade,
    lote: lote ? String(lote).trim() : "",
    ativo: ativo === undefined ? true : !!ativo,
  };
}

async function criarEmLote(req, res) {
  const { produtos } = req.body || {};

  if (!Array.isArray(produtos) || produtos.length === 0) {
    return fail(res, 400, "Informe ao menos um produto");
  }

  try {
    const normalized = produtos.map(normalizeProductPayload);
    const estoqueIds = [...new Set(normalized.map((produto) => produto.estoque_id))];

    for (const estoqueId of estoqueIds) {
      if (!(await estoqueService.findById(estoqueId))) {
        return fail(res, 404, `Estoque nao encontrado: ${estoqueId}`);
      }
    }

    const criados = await produtoService.createMany(normalized);
    return created(res, criados, "Produtos cadastrados");
  } catch (e) {
    return fail(res, e.status || 500, e.message || "Erro ao cadastrar produtos");
  }
}

async function listarLotes(req, res) {
  const id = Number(req.params.id);
  if (!id) return fail(res, 400, "Produto invalido");

  try {
    const lotes = await produtoService.listLotes(id, req.query.estoque_id);
    return ok(res, lotes);
  } catch (e) {
    return fail(res, e.status || 500, e.message || "Erro ao buscar lotes");
  }
}

async function atualizarLote(req, res) {
  const id = Number(req.params.id);
  const loteId = Number(req.params.loteId);
  const { lote, data_validade, quantidade } = req.body || {};

  if (!id) return fail(res, 400, "Produto invalido");
  if (!loteId) return fail(res, 400, "Lote invalido");
  if (quantidade !== undefined && (isNaN(Number(quantidade)) || Number(quantidade) < 0)) {
    return fail(res, 400, "quantidade invalida");
  }

  try {
    const atualizado = await produtoService.updateLote(id, loteId, {
      lote,
      data_validade,
      quantidade,
    });
    return ok(res, atualizado, "Lote atualizado");
  } catch (e) {
    return fail(res, e.status || 500, e.message || "Erro ao atualizar lote");
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
    estoque_id,
    data_validade,
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
      estoque_id: estoque_id != null ? Number(estoque_id) : undefined,
      data_validade,
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

module.exports = {
  listar,
  buscarPorCodigo,
  criar,
  criarEmLote,
  atualizar,
  atualizarLote,
  alterarStatus,
  remover,
  listarLotes,
};
