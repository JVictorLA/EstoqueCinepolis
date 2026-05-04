const produtoService = require("../services/produtoService");
const { ok } = require("../utils/response");

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
    status:
      p.sem_estoque ? "sem_estoque" :
      p.estoque_baixo ? "baixo_estoque" : "ok",
  }));
  return ok(res, data);
}

module.exports = { listar };
