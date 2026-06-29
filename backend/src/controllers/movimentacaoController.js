const produtoService = require("../services/produtoService");
const usuarioService = require("../services/usuarioService");
const movService = require("../services/movimentacaoService");
const { ok, created, fail } = require("../utils/response");

function sendPasswordChallenge(res, cred) {
  const message =
    cred.password_status === "expired"
      ? "Sua senha expirou. Troque-a para continuar."
      : "Primeiro acesso detectado. Troque a senha para continuar.";

  return res.status(403).json({
    success: false,
    message,
    data: usuarioService.buildPasswordChallenge(cred),
    error: message,
  });
}

function sendStockTimeBlock(res, error) {
  return res.status(error.status || 403).json({
    success: false,
    message: error.message,
    data: {
      estoque_bloqueado_por_horario: true,
      ...(error.estoque_bloqueado_por_horario || {}),
    },
    error: error.message,
  });
}

function sendMaintenanceBlock(res, error) {
  return res.status(error.status || 403).json({
    success: false,
    message: error.message,
    data: { modo_manutencao: true },
    error: error.message,
  });
}

function sendTemporaryUserLock(res, cred) {
  return res.status(cred.status || 403).json({
    success: false,
    message: cred.message,
    data: {
      usuario_bloqueado_temporariamente: true,
      retry_after_seconds: cred.retry_after_seconds,
      aviso_ultimas_tentativas_apos_timer: !!cred.aviso_ultimas_tentativas_apos_timer,
    },
    error: cred.message,
  });
}

function sendAutoDisabledUser(res, cred) {
  return res.status(cred.status || 403).json({
    success: false,
    message: cred.message,
    data: {
      usuario_desabilitado_por_senha: true,
    },
    error: cred.message,
  });
}

async function validateAdminAuthorization(autorizacaoAdmin) {
  if (!autorizacaoAdmin) return false;

  const cred = await usuarioService.validateCredentials(
    autorizacaoAdmin.matricula,
    autorizacaoAdmin.senha,
  );
  if (cred?.error === "locked") {
    throw Object.assign(new Error(cred.message), {
      status: 403,
      usuario_bloqueado_temporariamente: true,
      retry_after_seconds: cred.retry_after_seconds,
      aviso_ultimas_tentativas_apos_timer: !!cred.aviso_ultimas_tentativas_apos_timer,
    });
  }
  if (cred?.error === "disabled_by_password_attempts") {
    throw Object.assign(new Error(cred.message), {
      status: cred.status || 403,
      usuario_desabilitado_por_senha: true,
    });
  }
  if (!cred || cred.error === "inactive" || cred.password_status) {
    throw Object.assign(new Error("Autorizacao administrativa invalida"), { status: 403 });
  }
  if (!["admin", "master"].includes(cred.tipo)) {
    throw Object.assign(new Error("Autorizacao restrita a administradores"), { status: 403 });
  }

  return true;
}

async function criar(req, res) {
  const {
    codigo_barras,
    matricula,
    senha,
    tipo,
    quantidade,
    estoque_id,
    observacao,
    lote,
    data_validade,
    confirmar_ignorar_fefo,
    justificativa_fefo,
    autorizacao_admin,
  } = req.body || {};

  if (!codigo_barras) return fail(res, 400, "codigo_barras é obrigatório");
  if (!Number(estoque_id)) return fail(res, 400, "estoque_id é obrigatório");
  if (!matricula || !senha) return fail(res, 400, "matrícula e senha são obrigatórias");
  if (!["entrada", "saida"].includes(tipo)) {
    return fail(res, 400, "tipo deve ser 'entrada' ou 'saida'");
  }
  const qtd = Number(quantidade);
  if (!Number.isFinite(qtd) || qtd <= 0) {
    return fail(res, 400, "quantidade inválida");
  }

  const cred = await usuarioService.validateCredentials(matricula, senha);
  if (!cred) return fail(res, 401, "Matrícula ou senha inválidos");
  if (cred.error === "inactive") return fail(res, 403, "Usuário inativo");
  if (cred.error === "locked") return sendTemporaryUserLock(res, cred);
  if (cred.error === "disabled_by_password_attempts") return sendAutoDisabledUser(res, cred);
  if (cred.password_status) return sendPasswordChallenge(res, cred);

  const produto =
    tipo === "entrada"
      ? await produtoService.findByBarcode(codigo_barras, "all")
      : await produtoService.findByBarcode(codigo_barras, estoque_id);
  if (!produto) return fail(res, 404, "Produto não encontrado");
  if (!produto.ativo) return fail(res, 400, "Produto inativo");
  if (produto.exige_validade && !lote) return fail(res, 400, "lote é obrigatório");
  if (tipo === "saida" && !produto.estoque_id) {
    return fail(res, 404, "Produto não vinculado ao estoque");
  }

  try {
    const autorizacaoAdminValida = await validateAdminAuthorization(autorizacao_admin);
    const mov = await movService.registrarMovimentacao({
      produto,
      estoque_id: Number(estoque_id),
      usuario: { id: cred.id, nome: cred.nome, tipo: cred.tipo },
      tipo,
      quantidade: qtd,
      observacao,
      lote,
      data_validade,
      confirmar_ignorar_fefo: !!confirmar_ignorar_fefo,
      justificativa_fefo,
      autorizacaoAdminValida,
    });

    if (mov.bloqueado_vencido) {
      return res.status(400).json({
        success: false,
        message: mov.message,
        data: mov,
        error: mov.message,
      });
    }

    return created(res, mov, "Movimentacao registrada");
  } catch (e) {
    if (e.modo_manutencao) return sendMaintenanceBlock(res, e);
    if (e.usuario_bloqueado_temporariamente) {
      return sendTemporaryUserLock(res, {
        status: e.status,
        message: e.message,
        retry_after_seconds: e.retry_after_seconds,
        aviso_ultimas_tentativas_apos_timer: e.aviso_ultimas_tentativas_apos_timer,
      });
    }
    if (e.usuario_desabilitado_por_senha) {
      return sendAutoDisabledUser(res, {
        status: e.status,
        message: e.message,
      });
    }
    if (e.estoque_bloqueado_por_horario) return sendStockTimeBlock(res, e);
    if (e.fefo) {
      return res.status(e.status || 409).json({
        success: false,
        message: e.message,
        data: { fefo: e.fefo },
        error: e.message,
      });
    }
    return fail(res, e.status || 500, e.message || "Erro ao registrar movimentação");
  }
}

async function criarEntrada(req, res) {
  req.body = { ...(req.body || {}), tipo: "entrada" };
  return criar(req, res);
}

async function criarSaida(req, res) {
  req.body = { ...(req.body || {}), tipo: "saida" };
  return criar(req, res);
}

async function transferir(req, res) {
  const {
    codigo_barras,
    matricula,
    senha,
    quantidade,
    estoque_origem_id,
    estoque_destino_id,
    observacao,
    lote,
    confirmar_ignorar_fefo,
    justificativa_fefo,
    autorizacao_admin,
  } = req.body || {};

  if (!codigo_barras) return fail(res, 400, "codigo_barras é obrigatório");
  if (!Number(estoque_origem_id)) return fail(res, 400, "estoque_origem_id é obrigatório");
  if (!Number(estoque_destino_id)) return fail(res, 400, "estoque_destino_id é obrigatório");
  if (Number(estoque_origem_id) === Number(estoque_destino_id)) {
    return fail(res, 400, "Estoque de destino deve ser diferente da origem");
  }
  if (!matricula || !senha) return fail(res, 400, "matrícula e senha são obrigatórias");

  const qtd = Number(quantidade);
  if (!Number.isFinite(qtd) || qtd <= 0) {
    return fail(res, 400, "quantidade inválida");
  }

  const cred = await usuarioService.validateCredentials(matricula, senha);
  if (!cred) return fail(res, 401, "Matrícula ou senha inválidos");
  if (cred.error === "inactive") return fail(res, 403, "Usuário inativo");
  if (cred.error === "locked") return sendTemporaryUserLock(res, cred);
  if (cred.error === "disabled_by_password_attempts") return sendAutoDisabledUser(res, cred);
  if (cred.password_status) return sendPasswordChallenge(res, cred);

  const produto = await produtoService.findByBarcode(codigo_barras, estoque_origem_id);
  if (!produto) return fail(res, 404, "Produto não encontrado no estoque de origem");
  if (!produto.ativo) return fail(res, 400, "Produto inativo");
  if (produto.exige_validade && !lote) return fail(res, 400, "lote é obrigatório");
  if (!produto.estoque_id) return fail(res, 404, "Produto não vinculado ao estoque de origem");

  try {
    const autorizacaoAdminValida = await validateAdminAuthorization(autorizacao_admin);
    const transferencia = await movService.transferirEstoque({
      produto,
      estoque_origem_id: Number(estoque_origem_id),
      estoque_destino_id: Number(estoque_destino_id),
      usuario: { id: cred.id, nome: cred.nome, tipo: cred.tipo },
      quantidade: qtd,
      observacao,
      lote,
      confirmar_ignorar_fefo: !!confirmar_ignorar_fefo,
      justificativa_fefo,
      autorizacaoAdminValida,
    });
    return created(res, transferencia, "Transferencia registrada");
  } catch (e) {
    if (e.modo_manutencao) return sendMaintenanceBlock(res, e);
    if (e.usuario_bloqueado_temporariamente) {
      return sendTemporaryUserLock(res, {
        status: e.status,
        message: e.message,
        retry_after_seconds: e.retry_after_seconds,
        aviso_ultimas_tentativas_apos_timer: e.aviso_ultimas_tentativas_apos_timer,
      });
    }
    if (e.usuario_desabilitado_por_senha) {
      return sendAutoDisabledUser(res, {
        status: e.status,
        message: e.message,
      });
    }
    if (e.estoque_bloqueado_por_horario) return sendStockTimeBlock(res, e);
    if (e.fefo) {
      return res.status(e.status || 409).json({
        success: false,
        message: e.message,
        data: { fefo: e.fefo },
        error: e.message,
      });
    }
    return fail(res, e.status || 500, e.message || "Erro ao transferir produto");
  }
}

async function transferirLote(req, res) {
  const {
    matricula,
    senha,
    estoque_origem_id,
    estoque_destino_id,
    observacao,
    itens,
    autorizacao_admin,
  } = req.body || {};

  if (!Number(estoque_origem_id)) return fail(res, 400, "estoque_origem_id Ã© obrigatÃ³rio");
  if (!Number(estoque_destino_id)) return fail(res, 400, "estoque_destino_id Ã© obrigatÃ³rio");
  if (Number(estoque_origem_id) === Number(estoque_destino_id)) {
    return fail(res, 400, "Estoque de destino deve ser diferente da origem");
  }
  if (!matricula || !senha) return fail(res, 400, "matrÃ­cula e senha sÃ£o obrigatÃ³rias");
  if (!Array.isArray(itens) || !itens.length) {
    return fail(res, 400, "itens deve conter pelo menos um produto");
  }

  const cred = await usuarioService.validateCredentials(matricula, senha);
  if (!cred) return fail(res, 401, "MatrÃ­cula ou senha invÃ¡lidos");
  if (cred.error === "inactive") return fail(res, 403, "UsuÃ¡rio inativo");
  if (cred.error === "locked") return sendTemporaryUserLock(res, cred);
  if (cred.error === "disabled_by_password_attempts") return sendAutoDisabledUser(res, cred);
  if (cred.password_status) return sendPasswordChallenge(res, cred);

  const itensResolvidos = [];
  for (const [index, item] of itens.entries()) {
    if (!item?.codigo_barras) {
      return fail(res, 400, `codigo_barras Ã© obrigatÃ³rio no item ${index + 1}`);
    }
    const qtd = Number(item.quantidade);
    if (!Number.isFinite(qtd) || qtd <= 0) {
      return fail(res, 400, `quantidade invÃ¡lida no item ${index + 1}`);
    }

    const produto = await produtoService.findByBarcode(item.codigo_barras, estoque_origem_id);
    if (!produto) {
      return fail(res, 404, `Produto nÃ£o encontrado no estoque de origem: ${item.codigo_barras}`);
    }
    if (!produto.ativo) return fail(res, 400, `Produto inativo: ${produto.nome}`);
    if (produto.exige_validade && !item.lote) {
      return fail(res, 400, `lote Ã© obrigatÃ³rio para ${produto.nome}`);
    }
    if (!produto.estoque_id) {
      return fail(res, 404, `Produto nÃ£o vinculado ao estoque de origem: ${produto.nome}`);
    }

    itensResolvidos.push({
      produto,
      quantidade: qtd,
      lote: item.lote,
      confirmar_ignorar_fefo: !!item.confirmar_ignorar_fefo,
      justificativa_fefo: item.justificativa_fefo,
    });
  }

  try {
    const autorizacaoAdminValida = await validateAdminAuthorization(autorizacao_admin);
    const transferencia = await movService.transferirEstoqueEmLote({
      itens: itensResolvidos,
      estoque_origem_id: Number(estoque_origem_id),
      estoque_destino_id: Number(estoque_destino_id),
      usuario: { id: cred.id, nome: cred.nome, tipo: cred.tipo },
      observacao,
      autorizacaoAdminValida,
    });
    return created(res, transferencia, "Transferencia em lote registrada");
  } catch (e) {
    if (e.modo_manutencao) return sendMaintenanceBlock(res, e);
    if (e.usuario_bloqueado_temporariamente) {
      return sendTemporaryUserLock(res, {
        status: e.status,
        message: e.message,
        retry_after_seconds: e.retry_after_seconds,
        aviso_ultimas_tentativas_apos_timer: e.aviso_ultimas_tentativas_apos_timer,
      });
    }
    if (e.usuario_desabilitado_por_senha) {
      return sendAutoDisabledUser(res, {
        status: e.status,
        message: e.message,
      });
    }
    if (e.estoque_bloqueado_por_horario) return sendStockTimeBlock(res, e);
    if (e.fefo) {
      return res.status(e.status || 409).json({
        success: false,
        message: e.message,
        data: { fefo: e.fefo },
        error: e.message,
      });
    }
    return fail(res, e.status || 500, e.message || "Erro ao transferir produtos");
  }
}

async function ajustar(req, res) {
  const itens = req.body?.itens;
  if (!Array.isArray(itens)) return fail(res, 400, "itens deve ser uma lista");

  try {
    const ajustes = await movService.ajustarEstoque({
      usuario: { id: req.user.id, nome: req.user.nome },
      itens,
    });
    return created(res, ajustes, "Ajuste de estoque registrado");
  } catch (e) {
    return fail(res, e.status || 500, e.message || "Erro ao ajustar estoque");
  }
}

async function listar(req, res) {
  const rows = await movService.listar({
    data_inicial: req.query.data_inicial,
    data_final: req.query.data_final,
    tipo: req.query.tipo,
    categoria_id: req.query.categoria_id,
    produto_id: req.query.produto_id,
    codigo_barras: req.query.codigo_barras,
    usuario_id: req.query.usuario_id,
    estoque_id: req.query.estoque_id,
  });
  return ok(res, rows);
}

module.exports = { criar, criarEntrada, criarSaida, transferir, transferirLote, ajustar, listar };
