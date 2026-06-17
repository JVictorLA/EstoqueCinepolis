const configuracaoService = require("../services/configuracaoService");
const { ok, fail } = require("../utils/response");

async function listar(req, res) {
  const rows = await configuracaoService.getConfigsByNivelAcesso(req.user?.tipo || "admin");
  return ok(res, rows);
}

async function atualizar(req, res) {
  const configs = Array.isArray(req.body?.configs) ? req.body.configs : [];
  if (!configs.length) {
    return fail(res, 400, "Informe configs para atualizar");
  }

  const isMaster = req.user?.tipo === "master";
  const hasMasterConfig = configs.some((item) => item.nivelAcesso === "master");
  if (hasMasterConfig && !isMaster) {
    return fail(res, 403, "Configurações master só podem ser alteradas pelo master");
  }

  await configuracaoService.setManyConfigs(
    configs.map((item) => ({
      chave: item.chave,
      valor: item.valor,
      categoria: item.categoria,
      nivelAcesso: item.nivelAcesso || (isMaster ? "master" : "admin"),
    })),
    req.user?.id || null,
  );

  return ok(res, null, "Configurações atualizadas");
}

module.exports = { listar, atualizar };
