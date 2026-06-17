const produtoService = require("../services/produtoService");
const estoqueService = require("../services/estoqueService");
const { ok, created, fail } = require("../utils/response");

/**
 * GET /estoque — posição atual de estoque com status de alerta.
 */
async function listar(_req, res) {
  const produtos = await produtoService.listAll();
  const data = produtos.map((p) => ({
    id: p.id,
    codigo_barras: p.codigo_barras,
    nome: p.nome,
    categoria_id: p.categoria_id,
    categoria_nome: p.categoria_nome,
    unidade: p.unidade,
    preco_venda: p.preco_venda,
    estoque_atual: p.estoque_atual,
    estoque_minimo: p.estoque_minimo,
    ativo: !!p.ativo,
    sem_estoque: !!p.sem_estoque,
    estoque_baixo: !!p.estoque_baixo,
    status: p.sem_estoque ? "sem_estoque" : p.estoque_baixo ? "baixo_estoque" : "ok",
  }));
  return ok(res, data);
}

async function listarEstoques(_req, res) {
  const rows = await estoqueService.listAll();
  return ok(res, rows);
}

async function criar(req, res) {
  const { nome, ativo } = req.body || {};
  const nomeNormalizado = nome ? String(nome).trim() : "";

  if (!nomeNormalizado) {
    return fail(res, 400, "nome é obrigatório");
  }

  if (await estoqueService.existsByName(nomeNormalizado)) {
    return fail(res, 409, "Estoque ja cadastrado");
  }

  const novo = await estoqueService.create({
    nome: nomeNormalizado,
    ativo: ativo === undefined ? true : !!ativo,
  });

  return created(res, novo, "Estoque criado");
}

async function alterarStatus(req, res) {
  const id = Number(req.params.id);
  if (!id) return fail(res, 400, "id inválido");

  const { ativo } = req.body || {};
  if (ativo === undefined) return fail(res, 400, "Informe 'ativo' (true/false)");

  const existing = await estoqueService.findById(id);
  if (!existing) return fail(res, 404, "Estoque não encontrado");

  const atualizado = await estoqueService.setStatus(id, !!ativo);
  return ok(res, atualizado, "Status atualizado");
}

module.exports = { listar, listarEstoques, criar, alterarStatus };
