const configuracaoService = require("../services/configuracaoService");
const { ok, fail } = require("../utils/response");

function isValidTime(value) {
  const match = String(value || "").match(/^(\d{2}):(\d{2})$/);
  if (!match) return false;
  return Number(match[1]) <= 23 && Number(match[2]) <= 59;
}

function validateStockTimeBlockConfigs(configs) {
  const byKey = new Map(configs.map((item) => [item.chave, item.valor]));
  const enabled = byKey.get("bloquear_movimentacao_por_horario");
  const isEnabled = ["true", "1", "sim", "yes", "on"].includes(
    String(enabled).trim().toLowerCase(),
  );
  const start = byKey.get("horario_bloqueio_inicio");
  const end = byKey.get("horario_bloqueio_fim");

  for (const [key, value] of [
    ["horario_bloqueio_inicio", start],
    ["horario_bloqueio_fim", end],
  ]) {
    if (byKey.has(key) && value && !isValidTime(value)) {
      return "Horario de bloqueio invalido. Use HH:mm.";
    }
  }

  if (byKey.has("bloquear_movimentacao_por_horario") && isEnabled) {
    if (!isValidTime(start) || !isValidTime(end)) {
      return "Informe inicio e termino do bloqueio no formato HH:mm.";
    }
    if (start === end) {
      return "Inicio e termino do bloqueio precisam ser diferentes.";
    }
  }

  return null;
}

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

  const validationError = validateStockTimeBlockConfigs(configs);
  if (validationError) return fail(res, 400, validationError);

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
