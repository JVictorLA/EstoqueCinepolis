const kitService = require("../services/kitService");
const { ok, created, fail } = require("../utils/response");

async function listar(req, res) {
  const rows = await kitService.listar({ estoque_id: req.query.estoque_id });
  return ok(res, rows);
}

async function listarOperacional(req, res) {
  if (!req.query.estoque_id) return fail(res, 400, "Estoque é obrigatório");
  const rows = await kitService.listar({ estoque_id: req.query.estoque_id });
  return ok(res, rows);
}

async function buscar(req, res) {
  const kit = await kitService.buscar(Number(req.params.id));
  if (!kit) return fail(res, 404, "Kit não encontrado");
  return ok(res, kit);
}

async function buscarOperacional(req, res) {
  const kit = await kitService.buscar(Number(req.params.id));
  if (!kit) return fail(res, 404, "Kit não encontrado");
  if (req.query.estoque_id && Number(req.query.estoque_id) !== Number(kit.estoque_id)) {
    return fail(res, 404, "Kit não encontrado no estoque selecionado");
  }
  return ok(res, kit);
}

async function criar(req, res) {
  const kit = await kitService.criar({
    estoque_id: req.body?.estoque_id,
    nome: req.body?.nome,
    itens: req.body?.itens,
    usuario_id: req.user.id,
  });
  return created(res, kit, "Kit criado");
}

async function atualizar(req, res) {
  const kit = await kitService.atualizar({
    kitId: Number(req.params.id),
    nome: req.body?.nome,
    itens: req.body?.itens,
    usuario_id: req.user.id,
  });
  return ok(res, kit, "Kit atualizado");
}

async function montar(req, res) {
  const kit = await kitService.montarOuRepor({
    kitId: Number(req.params.id),
    usuario_id: req.user.id,
    tipo: "montagem",
    observacao: req.body?.observacao,
  });
  return ok(res, kit, "Kit montado");
}

async function repor(req, res) {
  const kit = await kitService.montarOuRepor({
    kitId: Number(req.params.id),
    usuario_id: req.user.id,
    tipo: "reposicao",
    observacao: req.body?.observacao,
  });
  return ok(res, kit, "Kit reposto");
}

async function retirar(req, res) {
  try {
    const kit = await kitService.retirar({
      kitId: Number(req.params.id),
      matricula: req.body?.matricula,
      senha: req.body?.senha,
      observacao: req.body?.observacao,
    });
    return ok(res, kit, "Kit retirado");
  } catch (e) {
    if (e.password_challenge) {
      return res.status(e.status || 403).json({
        success: false,
        message: e.message,
        data: e.password_challenge,
        error: e.message,
      });
    }
    return fail(res, e.status || 500, e.message || "Erro ao retirar kit");
  }
}

async function receber(req, res) {
  try {
    const kit = await kitService.receber({
      kitId: Number(req.params.id),
      matricula: req.body?.matricula,
      senha: req.body?.senha,
      itens: req.body?.itens,
      observacao: req.body?.observacao,
    });
    return ok(res, kit, "Kit recebido");
  } catch (e) {
    if (e.password_challenge) {
      return res.status(e.status || 403).json({
        success: false,
        message: e.message,
        data: e.password_challenge,
        error: e.message,
      });
    }
    return fail(res, e.status || 500, e.message || "Erro ao receber kit");
  }
}

async function historico(req, res) {
  const rows = await kitService.historico({
    estoque_id: req.query.estoque_id,
    kit_id: req.query.kit_id,
  });
  return ok(res, rows);
}

async function produtosDisponiveis(req, res) {
  const rows = await kitService.produtosDisponiveis(req.query.estoque_id);
  return ok(res, rows);
}

module.exports = {
  listar,
  listarOperacional,
  buscar,
  buscarOperacional,
  criar,
  atualizar,
  montar,
  repor,
  retirar,
  receber,
  historico,
  produtosDisponiveis,
};
