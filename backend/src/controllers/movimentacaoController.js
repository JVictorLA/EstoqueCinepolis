const produtoService = require("../services/produtoService");
const usuarioService = require("../services/usuarioService");
const movService = require("../services/movimentacaoService");
const { ok, created, fail } = require("../utils/response");

async function criar(req, res) {
  const {
    codigo_barras,
    matricula,
    senha,
    tipo,
    quantidade,
    observacao,
  } = req.body || {};

  if (!codigo_barras) return fail(res, 400, "codigo_barras é obrigatório");
  if (!matricula || !senha) return fail(res, 400, "matrícula e senha são obrigatórias");
  if (!["entrada", "saida"].includes(tipo)) {
    return fail(res, 400, "tipo deve ser 'entrada' ou 'saida'");
  }
  const qtd = Number(quantidade);
  if (!Number.isFinite(qtd) || qtd <= 0) {
    return fail(res, 400, "quantidade inválida");
  }

  // Valida usuário pela matrícula + senha (admin OU operador)
  const cred = await usuarioService.validateCredentials(matricula, senha);
  if (!cred) return fail(res, 401, "Matrícula ou senha inválidos");
  if (cred.error === "inactive") return fail(res, 403, "Usuário inativo");

  // Busca produto pelo código de barras
  const produto = await produtoService.findByBarcode(codigo_barras);
  if (!produto) return fail(res, 404, "Produto não encontrado");
  if (!produto.ativo) return fail(res, 400, "Produto inativo");

  try {
    const mov = await movService.registrarMovimentacao({
      produto,
      usuario: { id: cred.id, nome: cred.nome },
      tipo,
      quantidade: qtd,
      observacao,
    });
    return created(res, mov, "Movimentação registrada");
  } catch (e) {
    return fail(res, e.status || 500, e.message || "Erro ao registrar movimentação");
  }
}

async function listar(req, res) {
  const rows = await movService.listar({
    data_inicial: req.query.data_inicial,
    data_final: req.query.data_final,
    tipo: req.query.tipo,
    produto_id: req.query.produto_id,
    codigo_barras: req.query.codigo_barras,
    usuario_id: req.query.usuario_id,
  });
  return ok(res, rows);
}

module.exports = { criar, listar };
