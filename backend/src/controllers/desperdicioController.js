const desperdicioService = require("../services/desperdicioService");
const usuarioService = require("../services/usuarioService");
const { ok, created, fail } = require("../utils/response");

async function listarMotivos(_req, res) {
  const rows = await desperdicioService.listarMotivosAtivos();
  return ok(res, rows);
}

async function criar(req, res) {
  const { estoque_id, codigo_barras, quantidade, motivo_id, matricula, senha, lote } =
    req.body || {};

  if (!Number(estoque_id)) return fail(res, 400, "estoque_id e obrigatorio");
  if (!codigo_barras) return fail(res, 400, "codigo_barras e obrigatorio");
  if (!Number(motivo_id)) return fail(res, 400, "motivo_id e obrigatorio");
  if (!matricula || !senha) return fail(res, 400, "matricula e senha sao obrigatorias");

  const qtd = Number(quantidade);
  if (!Number.isFinite(qtd) || qtd <= 0) {
    return fail(res, 400, "quantidade invalida");
  }

  const cred = await usuarioService.validateCredentials(matricula, senha);
  if (!cred) return fail(res, 401, "Matricula ou senha invalidos");
  if (cred.error === "inactive") return fail(res, 403, "Usuario inativo");

  try {
    const desperdicio = await desperdicioService.registrarManual({
      estoque_id: Number(estoque_id),
      codigo_barras,
      quantidade: qtd,
      motivo_id: Number(motivo_id),
      usuario: { id: cred.id, nome: cred.nome },
      lote,
    });
    return created(res, desperdicio, "Desperdicio registrado");
  } catch (e) {
    return fail(res, e.status || 500, e.message || "Erro ao registrar desperdicio");
  }
}

async function listar(req, res) {
  const rows = await desperdicioService.listar({
    estoque_id: req.query.estoque_id,
    produto_id: req.query.produto_id,
    usuario_id: req.query.usuario_id,
    motivo_id: req.query.motivo_id,
    data_inicial: req.query.data_inicial,
    data_final: req.query.data_final,
  });
  return ok(res, rows);
}

async function resumo(req, res) {
  const data = await desperdicioService.resumo({
    estoque_id: req.query.estoque_id,
    produto_id: req.query.produto_id,
    usuario_id: req.query.usuario_id,
    motivo_id: req.query.motivo_id,
    data_inicial: req.query.data_inicial,
    data_final: req.query.data_final,
  });
  return ok(res, data);
}

async function processarVencidos(req, res) {
  try {
    const data = await desperdicioService.processarVencidos({
      id: req.user.id,
      nome: req.user.nome,
    });
    return ok(res, data, "Produtos vencidos processados");
  } catch (e) {
    return fail(res, e.status || 500, e.message || "Erro ao processar produtos vencidos");
  }
}

module.exports = {
  listarMotivos,
  criar,
  listar,
  resumo,
  processarVencidos,
};
