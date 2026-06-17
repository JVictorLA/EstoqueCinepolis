const usuarioService = require("../services/usuarioService");
const setupService = require("../services/setupService");
const configuracaoService = require("../services/configuracaoService");
const { ok, created, fail } = require("../utils/response");

async function status(_req, res) {
  const setupStatus = await setupService.getStatus();
  return ok(res, setupStatus);
}

async function setupInicial(req, res) {
  const setupStatus = await setupService.getStatus();
  if (!setupStatus.precisaSetup) {
    return fail(res, 409, "Setup inicial ja foi concluido");
  }

  try {
    const result = await setupService.executarSetupInicial(req.body || {});
    return created(res, result, "Configuracao inicial concluida");
  } catch (error) {
    return fail(res, error.status || 500, error.message || "Erro ao concluir setup inicial");
  }
}

async function criarMaster(req, res) {
  const { nome, matricula, email, senha } = req.body || {};

  if (!nome || !matricula || !senha) {
    return fail(res, 400, "nome, matrícula e senha são obrigatórios");
  }

  if (await usuarioService.existsAdminOrMaster()) {
    return fail(res, 409, "Setup inicial ja foi concluido");
  }

  if (await usuarioService.existsByMatricula(matricula)) {
    return fail(res, 409, "Matrícula já cadastrada");
  }

  const master = await usuarioService.createMaster({
    nome: String(nome).trim(),
    matricula: String(matricula).trim(),
    email: email ? String(email).trim() : null,
    senha,
  });

  await configuracaoService.setManyConfigs(
    [
      { chave: "setup_concluido", valor: true, categoria: "setup", nivelAcesso: "master" },
      {
        chave: "setup_data_conclusao",
        valor: new Date().toISOString(),
        categoria: "setup",
        nivelAcesso: "master",
      },
      { chave: "nome_sistema", valor: "Zytrex Inventory", categoria: "sistema", nivelAcesso: "admin" },
      { chave: "tema_padrao", valor: "light", categoria: "sistema", nivelAcesso: "admin" },
      {
        chave: "registrar_vencido_ao_tentar_retirar",
        valor: true,
        categoria: "desperdicio",
        nivelAcesso: "master",
      },
    ],
    master.id,
  );

  return created(res, master, "Usuário master criado");
}

module.exports = { status, setupInicial, criarMaster };
