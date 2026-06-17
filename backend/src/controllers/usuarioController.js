const bcrypt = require("bcrypt");
const usuarioService = require("../services/usuarioService");
const { ok, created, fail } = require("../utils/response");

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
    return fail(res, 401, "Senha atual incorreta");
  }

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
  return ok(res, atualizado, "Status atualizado");
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

module.exports = {
  buscarPorMatricula,
  listar,
  criar,
  atualizar,
  alterarStatus,
  alterarSenha,
  atualizarPreferencias,
  resetarSenha,
};
