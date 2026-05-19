const usuarioService = require("../services/usuarioService");
const { ok, created, fail } = require("../utils/response");

async function status(_req, res) {
  const hasAdminOrMaster = await usuarioService.existsAdminOrMaster();
  return ok(res, { precisaSetup: !hasAdminOrMaster });
}

async function criarMaster(req, res) {
  const { nome, matricula, email, senha } = req.body || {};

  if (!nome || !matricula || !senha) {
    return fail(res, 400, "nome, matricula e senha sao obrigatorios");
  }

  if (await usuarioService.existsAdminOrMaster()) {
    return fail(res, 409, "Setup inicial ja foi concluido");
  }

  if (await usuarioService.existsByMatricula(matricula)) {
    return fail(res, 409, "Matricula ja cadastrada");
  }

  const master = await usuarioService.createMaster({
    nome: String(nome).trim(),
    matricula: String(matricula).trim(),
    email: email ? String(email).trim() : null,
    senha,
  });

  return created(res, master, "Usuario master criado");
}

module.exports = { status, criarMaster };
