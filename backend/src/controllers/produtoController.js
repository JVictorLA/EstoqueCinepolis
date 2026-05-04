const produtoService = require("../services/produtoService");
const { ok, created, fail } = require("../utils/response");

async function listar(_req, res) {
  const rows = await produtoService.listAll();
  return ok(res, rows);
}

async function buscarPorCodigo(req, res) {
  const { codigo_barras } = req.params;
  if (!codigo_barras) return fail(res, 400, "Código de barras obrigatório");
  const p = await produtoService.findByBarcode(codigo_barras);
  if (!p) return fail(res, 404, "Produto não encontrado");
  return ok(res, p);
}

async function criar(req, res) {
  const {
    codigo_barras,
    nome,
    categoria_id,
    unidade,
    preco_venda,
    estoque_atual,
    estoque_minimo,
    ativo,
  } = req.body || {};

  if (!codigo_barras || !nome) {
    return fail(res, 400, "codigo_barras e nome são obrigatórios");
  }
  if (categoria_id == null) {
    return fail(res, 400, "categoria_id é obrigatório");
  }
  if (preco_venda == null || isNaN(Number(preco_venda))) {
    return fail(res, 400, "preco_venda inválido");
  }

  if (await produtoService.existsByBarcode(codigo_barras)) {
    return fail(res, 409, "Código de barras já cadastrado");
  }

  const novo = await produtoService.create({
    codigo_barras: String(codigo_barras).trim(),
    nome: String(nome).trim(),
    categoria_id: Number(categoria_id),
    unidade: unidade ? String(unidade).trim() : "un",
    preco_venda: Number(preco_venda),
    estoque_atual: estoque_atual != null ? Number(estoque_atual) : 0,
    estoque_minimo: estoque_minimo != null ? Number(estoque_minimo) : 0,
    ativo: ativo === undefined ? true : !!ativo,
  });

  return created(res, novo, "Produto cadastrado");
}

module.exports = { listar, buscarPorCodigo, criar };
