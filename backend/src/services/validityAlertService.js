const { pool } = require("../database/connection");
const configuracaoService = require("./configuracaoService");
const emailService = require("./emailService");

const MS_PER_DAY = 86400000;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toDateOnly(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function formatDateBr(value) {
  const dateOnly = toDateOnly(value);
  if (!dateOnly) return "Sem validade";
  const [year, month, day] = dateOnly.split("-");
  return `${day}/${month}/${year}`;
}

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

function daysUntil(value) {
  const dateOnly = toDateOnly(value);
  const expiration = new Date(`${dateOnly}T00:00:00`);
  const today = new Date(`${todayDateOnly()}T00:00:00`);
  if (Number.isNaN(expiration.getTime())) return null;
  return Math.ceil((expiration.getTime() - today.getTime()) / MS_PER_DAY);
}

function displayDays(days) {
  if (days === null) return "-";
  if (days < 0) return `Vencido ha ${Math.abs(days)} dia(s)`;
  if (days === 0) return "Vence hoje";
  return `Vence em ${days} dia(s)`;
}

function normalizeAlertDays(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 7;
}

async function getMasterRecipient(conn = pool) {
  const [rows] = await conn.query(
    `SELECT id, nome, email
       FROM usuarios
      WHERE tipo = 'master'
        AND ativo = 1
        AND email IS NOT NULL
        AND TRIM(email) <> ''
      ORDER BY id ASC
      LIMIT 1`,
  );
  return rows[0] || null;
}

async function getCompanyLabel(conn = pool) {
  const [nome, unidade] = await Promise.all([
    configuracaoService.getConfig("nome_empresa", conn),
    configuracaoService.getConfig("unidade_empresa", conn),
  ]);
  return [nome, unidade]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join(" - ");
}

async function getAlertDays(conn = pool) {
  return normalizeAlertDays(await configuracaoService.getConfig("dias_alerta_validade", conn));
}

async function listValidityAlertItems(alertDays, conn = pool) {
  const [rows] = await conn.query(
    `SELECT *
       FROM (
        SELECT
          p.id AS produto_id,
          p.codigo_barras,
          p.nome AS produto_nome,
          e.id AS estoque_id,
          e.nome AS estoque_nome,
          pl.lote,
          pl.data_validade,
          pl.quantidade
         FROM produto_lotes pl
         INNER JOIN estoque_produtos ep ON ep.id = pl.estoque_produto_id
         INNER JOIN produtos p ON p.id = ep.produto_id
         INNER JOIN categorias c ON c.id = p.categoria_id
         INNER JOIN estoques e ON e.id = ep.estoque_id
        WHERE p.ativo = 1
          AND COALESCE(c.exige_validade, 0) = 1
          AND COALESCE(e.arquivado, 0) = 0
          AND pl.data_validade IS NOT NULL
          AND pl.quantidade > 0
          AND pl.data_validade <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
        UNION ALL
        SELECT
          p.id AS produto_id,
          p.codigo_barras,
          p.nome AS produto_nome,
          e.id AS estoque_id,
          e.nome AS estoque_nome,
          NULL AS lote,
          ep.data_validade,
          ep.estoque_atual AS quantidade
         FROM estoque_produtos ep
         INNER JOIN produtos p ON p.id = ep.produto_id
         INNER JOIN categorias c ON c.id = p.categoria_id
         INNER JOIN estoques e ON e.id = ep.estoque_id
        WHERE p.ativo = 1
          AND COALESCE(c.exige_validade, 0) = 1
          AND COALESCE(e.arquivado, 0) = 0
          AND ep.data_validade IS NOT NULL
          AND ep.estoque_atual > 0
          AND ep.data_validade <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
          AND NOT EXISTS (
            SELECT 1
              FROM produto_lotes pl_existing
             WHERE pl_existing.estoque_produto_id = ep.id
          )
       ) alertas
      ORDER BY data_validade ASC, produto_nome ASC, estoque_nome ASC, lote ASC`,
    [alertDays, alertDays],
  );

  return rows.map((row) => {
    const days = daysUntil(row.data_validade);
    return {
      ...row,
      dias_restantes: days,
      status: days !== null && days < 0 ? "vencido" : "proximo",
    };
  });
}

async function wasAlertAlreadyRegistered(alertDate, recipientEmail, conn = pool) {
  const [rows] = await conn.query(
    `SELECT id, status
       FROM email_alertas_validade
      WHERE alerta_data = ?
        AND destinatario_email = ?
      LIMIT 1`,
    [alertDate, recipientEmail],
  );
  return rows[0] || null;
}

async function createPendingAlert(recipient, alertDate, totalItems, conn = pool) {
  const [result] = await conn.query(
    `INSERT INTO email_alertas_validade
       (alerta_data, usuario_id, destinatario_email, status, quantidade_itens, criado_em, atualizado_em)
     VALUES (?, ?, ?, 'pendente', ?, NOW(), NOW())`,
    [alertDate, recipient.id, recipient.email, totalItems],
  );
  return result.insertId;
}

async function updateAlertStatus(id, status, errorMessage = null, conn = pool) {
  await conn.query(
    `UPDATE email_alertas_validade
        SET status = ?,
            erro = ?,
            enviado_em = CASE WHEN ? = 'enviado' THEN NOW() ELSE enviado_em END,
            atualizado_em = NOW()
      WHERE id = ?`,
    [status, errorMessage ? String(errorMessage).slice(0, 1000) : null, status, id],
  );
}

function renderRows(items) {
  return items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.produto_nome)}</td>
          <td>${escapeHtml(item.codigo_barras || "-")}</td>
          <td>${escapeHtml(item.estoque_nome || "-")}</td>
          <td>${escapeHtml(item.lote || "-")}</td>
          <td>${escapeHtml(formatDateBr(item.data_validade))}</td>
          <td>${escapeHtml(displayDays(item.dias_restantes))}</td>
          <td>${escapeHtml(Number(item.quantidade).toLocaleString("pt-BR"))}</td>
        </tr>`,
    )
    .join("");
}

function renderTable(title, items) {
  if (!items.length) return "";
  return `
    <h2>${escapeHtml(title)}</h2>
    <table>
      <thead>
        <tr>
          <th>Produto</th>
          <th>Codigo</th>
          <th>Estoque</th>
          <th>Lote</th>
          <th>Validade</th>
          <th>Prazo</th>
          <th>Quantidade</th>
        </tr>
      </thead>
      <tbody>${renderRows(items)}</tbody>
    </table>`;
}

function buildEmailContent({ companyLabel, alertDate, alertDays, items }) {
  const expired = items.filter((item) => item.status === "vencido");
  const near = items.filter((item) => item.status !== "vencido");
  const company = companyLabel || "Zytrex Inventory";
  const subject = `Alerta de validade - ${company} - ${formatDateBr(alertDate)}`;

  const textLines = [
    `Alerta de validade - ${company}`,
    `Data: ${formatDateBr(alertDate)}`,
    `Periodo monitorado: vencidos e produtos que vencem em ate ${alertDays} dia(s).`,
    `Vencidos: ${expired.length}`,
    `Proximos de vencer: ${near.length}`,
    "",
  ];

  for (const [title, group] of [
    ["Vencidos", expired],
    ["Proximos de vencer", near],
  ]) {
    if (!group.length) continue;
    textLines.push(title);
    group.forEach((item) => {
      textLines.push(
        `- ${item.produto_nome} | ${item.codigo_barras || "-"} | ${item.estoque_nome || "-"} | lote ${item.lote || "-"} | ${formatDateBr(item.data_validade)} | ${displayDays(item.dias_restantes)} | qtd ${Number(item.quantidade).toLocaleString("pt-BR")}`,
      );
    });
    textLines.push("");
  }

  const html = `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: Arial, sans-serif; color: #111827; line-height: 1.45; }
        h1 { font-size: 20px; margin-bottom: 8px; }
        h2 { font-size: 16px; margin-top: 24px; }
        .summary { margin: 16px 0; padding: 12px; background: #f3f4f6; border-radius: 8px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 13px; }
        th { background: #e5e7eb; }
      </style>
    </head>
    <body>
      <h1>Alerta de validade - ${escapeHtml(company)}</h1>
      <p>Resumo de produtos vencidos e produtos que vencem em ate ${escapeHtml(alertDays)} dia(s).</p>
      <div class="summary">
        <strong>Vencidos:</strong> ${escapeHtml(expired.length)}<br />
        <strong>Proximos de vencer:</strong> ${escapeHtml(near.length)}
      </div>
      ${renderTable("Vencidos", expired)}
      ${renderTable("Proximos de vencer", near)}
    </body>
  </html>`;

  return { subject, text: textLines.join("\n"), html };
}

async function runDailyValidityAlert() {
  if (!emailService.isSmtpConfigured()) {
    console.log("[VALIDADE_EMAIL] SMTP incompleto; envio de alertas desativado");
    return { sent: false, reason: "smtp_not_configured" };
  }

  const recipient = await getMasterRecipient();
  if (!recipient) {
    console.log("[VALIDADE_EMAIL] Nenhum usuario master ativo com email cadastrado");
    return { sent: false, reason: "missing_recipient" };
  }

  const alertDate = todayDateOnly();
  const existing = await wasAlertAlreadyRegistered(alertDate, recipient.email);
  if (existing) {
    console.log(`[VALIDADE_EMAIL] Alerta de ${alertDate} ja registrado para ${recipient.email}`);
    return { sent: false, reason: "already_registered" };
  }

  const alertDays = await getAlertDays();
  const items = await listValidityAlertItems(alertDays);
  if (!items.length) {
    console.log("[VALIDADE_EMAIL] Nenhum produto vencido ou proximo de vencer");
    return { sent: false, reason: "no_items" };
  }

  const alertId = await createPendingAlert(recipient, alertDate, items.length);
  const content = buildEmailContent({
    companyLabel: await getCompanyLabel(),
    alertDate,
    alertDays,
    items,
  });

  try {
    await emailService.sendMail({
      to: recipient.email,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
    await updateAlertStatus(alertId, "enviado");
    console.log(
      `[VALIDADE_EMAIL] Alerta enviado para ${recipient.email} com ${items.length} item(ns)`,
    );
    return { sent: true, items: items.length };
  } catch (error) {
    await updateAlertStatus(alertId, "falha", error.message);
    console.error("[VALIDADE_EMAIL] Falha ao enviar alerta:", error.message);
    return { sent: false, reason: "send_failed", error };
  }
}

module.exports = {
  buildEmailContent,
  getAlertDays,
  getMasterRecipient,
  listValidityAlertItems,
  runDailyValidityAlert,
};
