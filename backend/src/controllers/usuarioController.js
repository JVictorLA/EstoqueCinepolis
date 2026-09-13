const bcrypt = require("bcrypt");
const scaleWebhookService = require("../services/scaleWebhookService");
const usuarioService = require("../services/usuarioService");
const { ok, created, fail } = require("../utils/response");

function scaleFail(res, status, message) {
  return res.status(status).json({
    success: false,
    message,
  });
}

function parseAtualizadoDesde(value) {
  if (!value) return null;

  const parsed = new Date(String(value));

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

async function listarParaSyncScale(req, res) {
  const { atualizado_desde } = req.query || {};
  const atualizadoDesde = parseAtualizadoDesde(atualizado_desde);

  if (atualizado_desde && !atualizadoDesde) {
    return scaleFail(res, 400, "Parametro atualizado_desde invalido");
  }

  const usuarios = await usuarioService.listForScaleSync({ atualizadoDesde });
  return res.json(usuarios);
}

async function buscarPorMatricula(req, res) {
  const { matricula } = req.params;
  const user = await usuarioService.findByMatricula(matricula);

  if (!user) {
    return fail(res, 404, "Usuário não encontrado");
  }

  const passwordStatus = usuarioService.getPasswordStatus(user);

  return ok(
    res,
    {
      id: user.id,
      matricula: user.matricula,
      nome: user.nome,
      tipo: user.tipo,
      precisa_trocar_senha: !!user.precisa_trocar_senha,
      precisaTrocarSenha: !!user.precisa_trocar_senha,
      senha_expirada: passwordStatus === "expired",
      senhaExpirada: passwordStatus === "expired",
      password_status: passwordStatus,
      passwordStatus: passwordStatus,
      themePreference: user.theme_preference === "dark" ? "dark" : "light",
      ativo: !!user.ativo,
    },
    "Usuário encontrado",
  );
}

async function listar(req, res) {
  const rows = await usuarioService.listAll({
    includeMaster: req.user?.tipo === "master",
  });
  return ok(res, rows);
}

async function criar(req, res) {
  const { matricula, nome, email, senha, tipo, ativo } = req.body || {};

  if (!matricula || !nome || !tipo) {
    return fail(res, 400, "matrícula, nome e tipo são obrigatórios");
  }

  if (!["admin", "operador"].includes(tipo)) {
    return fail(res, 400, "tipo deve ser 'admin' ou 'operador'");
  }

  if (await usuarioService.existsByMatricula(matricula)) {
    return fail(res, 409, "Matrícula já cadastrada");
  }

  const novo = await usuarioService.create({
    matricula: String(matricula).trim(),
    nome: String(nome).trim(),
    email: email ? String(email).trim() : null,
    senha,
    tipo,
    ativo: ativo === undefined ? true : !!ativo,
  });

  await scaleWebhookService.notifyUsuarioChanged(novo, "criar");
  return created(res, novo, "Usuário criado");
}

async function atualizar(req, res) {
  const id = Number(req.params.id);
  if (!id) return fail(res, 400, "id inválido");

  const existing = await usuarioService.findById(id);
  if (!existing) return fail(res, 404, "Usuário não encontrado");

  const { matricula, nome, email, senha, tipo, ativo } = req.body || {};

  if (tipo && !["admin", "operador"].includes(tipo)) {
    return fail(res, 400, "tipo deve ser 'admin' ou 'operador'");
  }

  if (existing.tipo === "master") {
    if (tipo && tipo !== existing.tipo) {
      return fail(res, 403, "Usuário master não pode ter o tipo alterado");
    }
    if (ativo === false || ativo === 0) {
      return fail(res, 403, "Usuário master não pode ser desativado");
    }
  }

  if (matricula && matricula !== existing.matricula) {
    if (await usuarioService.existsByMatricula(matricula)) {
      return fail(res, 409, "Matrícula já cadastrada");
    }
  }

  const atualizado = await usuarioService.update(id, {
    matricula,
    nome,
    email,
    senha,
    tipo: existing.tipo === "master" ? undefined : tipo,
    ativo,
  });

  await scaleWebhookService.notifyUsuarioChanged(atualizado, "atualizar");
  return ok(res, atualizado, "Usuário atualizado");
}

async function alterarSenha(req, res) {
  const id = Number(req.params.id);
  const { senhaAtual, novaSenha } = req.body || {};

  if (!id) return fail(res, 400, "ID inválido");
  if (!senhaAtual || !novaSenha) {
    return fail(res, 400, "Informe senhaAtual e novaSenha");
  }

  const user = await usuarioService.findByIdWithPassword(id);
  if (!user) return fail(res, 404, "Usuário não encontrado");

  const senhaValida = await bcrypt.compare(senhaAtual, user.senha_hash);
  if (!senhaValida) {
    const locked = await usuarioService.registerFailedPasswordAttempt(user);
    if (locked?.error === "locked") {
      return res.status(403).json({
        success: false,
        message: locked.message,
        data: {
          usuario_bloqueado_temporariamente: true,
          retry_after_seconds: locked.retry_after_seconds,
          aviso_ultimas_tentativas_apos_timer: !!locked.aviso_ultimas_tentativas_apos_timer,
        },
        error: locked.message,
      });
    }
    if (locked?.error === "disabled_by_password_attempts") {
      return res.status(locked.status || 403).json({
        success: false,
        message: locked.message,
        data: {
          usuario_desabilitado_por_senha: true,
        },
        error: locked.message,
      });
    }
    return fail(res, 401, "Senha atual incorreta");
  }

  await usuarioService.resetPasswordFailures(id);

  const mesmaSenha = await bcrypt.compare(novaSenha, user.senha_hash);
  if (mesmaSenha) {
    return fail(res, 400, "A nova senha não pode ser igual à senha atual");
  }

  await usuarioService.update(id, { senha: novaSenha });
  return ok(res, null, "Senha atualizada com sucesso");
}

async function atualizarPreferencias(req, res) {
  const userId = Number(req.user?.id);
  if (!userId) return fail(res, 401, "Não autenticado");

  const { themePreference } = req.body || {};
  if (!["light", "dark"].includes(themePreference)) {
    return fail(res, 400, "themePreference deve ser 'light' ou 'dark'");
  }

  const atualizado = await usuarioService.updateThemePreference(userId, themePreference);
  return ok(
    res,
    {
      id: atualizado.id,
      themePreference: atualizado.theme_preference === "dark" ? "dark" : "light",
    },
    "Preferencias atualizadas",
  );
}

async function alterarStatus(req, res) {
  const id = Number(req.params.id);
  if (!id) return fail(res, 400, "id inválido");

  const { ativo } = req.body || {};
  if (ativo === undefined) return fail(res, 400, "Informe 'ativo' (true/false)");

  const existing = await usuarioService.findById(id);
  if (!existing) return fail(res, 404, "Usuário não encontrado");
  if (existing.tipo === "master") {
    return fail(res, 403, "Usuário master não pode ser desativado");
  }

  const atualizado = await usuarioService.setStatus(id, !!ativo);
  await scaleWebhookService.notifyUsuarioChanged(atualizado, "alterar_status");
  return ok(res, atualizado, "Status atualizado");
}

async function arquivar(req, res) {
  const id = Number(req.params.id);
  if (!id) return fail(res, 400, "ID invalido");

  const currentUserId = Number(req.user?.id);
  if (currentUserId === id) {
    return fail(res, 403, "Voce nao pode arquivar sua propria conta");
  }

  const existing = await usuarioService.findById(id);
  if (!existing) return fail(res, 404, "Usuario nao encontrado");

  if (existing.tipo === "master") {
    return fail(res, 403, "Usuario master nao pode ser arquivado");
  }

  const atualizado = await usuarioService.archiveUser(id);
  await scaleWebhookService.notifyUsuarioChanged(atualizado, "arquivar");
  return ok(res, atualizado, "Usuario arquivado");
}

async function restaurar(req, res) {
  const id = Number(req.params.id);
  if (!id) return fail(res, 400, "ID invalido");

  const existing = await usuarioService.findById(id);
  if (!existing) return fail(res, 404, "Usuario nao encontrado");

  if (existing.tipo === "master") {
    return fail(res, 403, "Usuario master nao pode ser restaurado pelo CRUD comum");
  }

  const atualizado = await usuarioService.restoreUser(id);
  await scaleWebhookService.notifyUsuarioChanged(atualizado, "restaurar");
  return ok(res, atualizado, "Usuario restaurado");
}

async function resetarSenha(req, res) {
  const id = Number(req.params.id);
  if (!id) return fail(res, 400, "ID inválido");

  const existing = await usuarioService.findById(id);
  if (!existing) return fail(res, 404, "Usuário não encontrado");
  if (existing.tipo === "master") {
    return fail(res, 403, "Senha do master não pode ser resetada pelo CRUD comum");
  }

  await usuarioService.resetPassword(id);
  return ok(res, null, "Senha temporária resetada; usuário deve trocá-la no próximo acesso");
}

async function recuperarSenhaMaster(req, res) {
  const { matricula, chaveRecuperacao, novaSenha, confirmarSenha } = req.body || {};

  try {
    const result = await usuarioService.recoverMasterPassword({
      matricula,
      recoveryKey: chaveRecuperacao,
      novaSenha,
      confirmarSenha,
    });
    return ok(res, result, "Senha do master redefinida");
  } catch (error) {
    if (error.data) {
      return res.status(error.status || 500).json({
        success: false,
        message: error.message || "Erro ao recuperar senha do master",
        data: error.data,
        error: error.message || "Erro ao recuperar senha do master",
      });
    }
    return fail(res, error.status || 500, error.message || "Erro ao recuperar senha do master");
  }
}

async function gerarChaveRecuperacaoMaster(req, res) {
  const userId = Number(req.user?.id);
  if (!userId) return fail(res, 401, "Não autenticado");

  try {
    const recovery = await usuarioService.generateMasterRecoveryKey(userId);
    return ok(res, recovery, "Chave de recuperação gerada");
  } catch (error) {
    return fail(res, error.status || 500, error.message || "Erro ao gerar chave de recuperação");
  }
}

async function remover(req, res) {
  const id = Number(req.params.id);
  if (!id) return fail(res, 400, "ID invalido");

  const currentUserId = Number(req.user?.id);
  if (currentUserId === id) {
    return fail(res, 403, "Voce nao pode excluir sua propria conta");
  }

  const existing = await usuarioService.findById(id);
  if (!existing) return fail(res, 404, "Usuario nao encontrado");

  if (existing.tipo === "master") {
    return fail(res, 403, "Usuario master nao pode ser excluido");
  }

  if (await usuarioService.hasDeleteBlockers(id)) {
    return fail(res, 409, "Usuario com historico nao pode ser excluido");
  }

  await usuarioService.remove(id);
  return ok(res, null, "Usuario excluido");
}

module.exports = {
  buscarPorMatricula,
  listarParaSyncScale,
  listar,
  criar,
  atualizar,
  alterarStatus,
  arquivar,
  restaurar,
  alterarSenha,
  atualizarPreferencias,
  resetarSenha,
  recuperarSenhaMaster,
  gerarChaveRecuperacaoMaster,
  remover,
};
