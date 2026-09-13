const config = require("../config");

function buildPayload(user) {
  return {
    id: user.id,
    nome: user.nome,
    matricula: user.matricula,
    tipo: user.tipo,
    ativo: !!user.ativo,
    atualizado_em: user.atualizado_em,
  };
}

async function notifyUsuarioChanged(user, action) {
  if (!config.scaleWebhook.enabled) return;

  if (!config.scaleWebhook.url || !config.scaleWebhook.token) {
    console.error("[SCALE_WEBHOOK]", {
      action,
      message: "Webhook do Scale nao configurado.",
      usuario_id: user?.id,
    });
    return;
  }

  const payload = buildPayload(user);

  try {
    const response = await fetch(config.scaleWebhook.url, {
      body: JSON.stringify(payload),
      headers: {
        Authorization: `Bearer ${config.scaleWebhook.token}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      console.error("[SCALE_WEBHOOK]", {
        action,
        message: data?.message || "Falha ao notificar Zytrex Scale.",
        status: response.status,
        usuario_id: user.id,
      });
    }
  } catch (error) {
    console.error("[SCALE_WEBHOOK]", {
      action,
      message: error.message,
      usuario_id: user?.id,
    });
  }
}

module.exports = {
  notifyUsuarioChanged,
};
