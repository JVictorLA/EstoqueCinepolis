const { pool } = require("../database/connection");

const STATUS = new Set(["pendente", "em_analise", "corrigida", "ignorada"]);
const FINAL_STATUS = new Set(["corrigida", "ignorada"]);
const ALLOWED_TRANSITIONS = {
  pendente: new Set(["em_analise", "corrigida", "ignorada"]),
  em_analise: new Set(["corrigida", "ignorada"]),
};

function mapAnomaly(row) {
  return {
    id: row.id,
    conferencia_id: row.conferencia_id,
    conferencia_item_id: row.conferencia_item_id,
    produto_id: row.produto_id,
    produto_nome: row.produto_nome,
    codigo_barras: row.codigo_barras,
    estoque_id: row.estoque_id,
    estoque_nome: row.estoque_nome,
    lote: row.lote,
    tipo: row.tipo,
    quantidade_sistema: Number(row.quantidade_sistema || 0),
    quantidade_contada: Number(row.quantidade_contada || 0),
    diferenca: Number(row.diferenca || 0),
    status: row.status,
    resolucao_observacao: row.resolucao_observacao,
    ajuste_movimentacao_id: row.ajuste_movimentacao_id,
    criado_por: row.criado_por,
    criado_por_nome: row.criado_por_nome,
    atualizado_por: row.atualizado_por,
    atualizado_por_nome: row.atualizado_por_nome,
    resolvido_por: row.resolvido_por,
    resolvido_por_nome: row.resolvido_por_nome,
    criado_em: row.criado_em,
    atualizado_em: row.atualizado_em,
    resolvido_em: row.resolvido_em,
    conferencia_finalizado_em: row.conferencia_finalizado_em,
  };
}

function mapHistory(row) {
  return {
    id: row.id,
    anomalia_id: row.anomalia_id,
    acao: row.acao,
    status_anterior: row.status_anterior,
    status_novo: row.status_novo,
    observacao: row.observacao,
    usuario_id: row.usuario_id,
    usuario_nome: row.usuario_nome,
    criado_em: row.criado_em,
  };
}

async function insertHistory(conn, { anomaliaId, acao, statusAnterior, statusNovo, observacao, usuarioId }) {
  await conn.query(
    `INSERT INTO conferencia_anomalia_historico
       (anomalia_id, acao, status_anterior, status_novo, observacao, usuario_id, criado_em)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [anomaliaId, acao, statusAnterior || null, statusNovo || null, observacao || null, usuarioId || null],
  );
}

async function createFromConference(conferenciaId, usuarioId, conn = pool) {
  const [items] = await conn.query(
    `SELECT
       i.id AS conferencia_item_id,
       i.conferencia_id,
       i.estoque_id,
       i.produto_id,
       i.quantidade_sistema,
       i.quantidade_contada,
       i.diferenca,
       i.status
     FROM conferencia_estoque_itens i
     WHERE i.conferencia_id = ? AND i.status <> 'ok'`,
    [conferenciaId],
  );

  let createdCount = 0;
  for (const item of items) {
    const tipo = Number(item.diferenca || 0) > 0 ? "sobra" : "falta";
    const [result] = await conn.query(
      `INSERT INTO conferencia_anomalias
         (conferencia_id, conferencia_item_id, produto_id, estoque_id, tipo,
          quantidade_sistema, quantidade_contada, diferenca, status, criado_por,
          atualizado_por, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendente', ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         produto_id = VALUES(produto_id),
         estoque_id = VALUES(estoque_id),
         tipo = VALUES(tipo),
         quantidade_sistema = VALUES(quantidade_sistema),
         quantidade_contada = VALUES(quantidade_contada),
         diferenca = VALUES(diferenca),
         atualizado_por = VALUES(atualizado_por),
         atualizado_em = NOW()`,
      [
        item.conferencia_id,
        item.conferencia_item_id,
        item.produto_id,
        item.estoque_id,
        tipo,
        item.quantidade_sistema,
        item.quantidade_contada,
        item.diferenca,
        usuarioId || null,
        usuarioId || null,
      ],
    );

    if (result.insertId) {
      createdCount += 1;
      await insertHistory(conn, {
        anomaliaId: result.insertId,
        acao: "criada",
        statusNovo: "pendente",
        observacao: "Anomalia criada automaticamente ao finalizar conferencia.",
        usuarioId,
      });
    }
  }

  return { total: createdCount };
}

function buildListWhere(filters = {}) {
  const where = [];
  const params = [];

  if (filters.id) {
    where.push("a.id = ?");
    params.push(Number(filters.id));
  }
  if (filters.status && filters.status !== "all") {
    if (filters.status === "abertas") {
      where.push("a.status IN ('pendente', 'em_analise')");
    } else {
      where.push("a.status = ?");
      params.push(filters.status);
    }
  }
  if (filters.tipo && filters.tipo !== "all") {
    where.push("a.tipo = ?");
    params.push(filters.tipo);
  }
  if (filters.estoque_id && filters.estoque_id !== "all") {
    where.push("a.estoque_id = ?");
    params.push(Number(filters.estoque_id));
  }
  if (filters.produto_id) {
    where.push("a.produto_id = ?");
    params.push(Number(filters.produto_id));
  }
  if (filters.data_inicial) {
    where.push("DATE(a.criado_em) >= ?");
    params.push(filters.data_inicial);
  }
  if (filters.data_final) {
    where.push("DATE(a.criado_em) <= ?");
    params.push(filters.data_final);
  }

  return {
    clause: where.length ? `WHERE ${where.join(" AND ")}` : "",
    params,
  };
}

async function list(filters = {}) {
  const { clause, params } = buildListWhere(filters);
  const [rows] = await pool.query(
    `SELECT
       a.*,
       p.nome AS produto_nome,
       p.codigo_barras,
       e.nome AS estoque_nome,
       c.finalizado_em AS conferencia_finalizado_em,
       uc.nome AS criado_por_nome,
       ua.nome AS atualizado_por_nome,
       ur.nome AS resolvido_por_nome
     FROM conferencia_anomalias a
     LEFT JOIN produtos p ON p.id = a.produto_id
     LEFT JOIN estoques e ON e.id = a.estoque_id
     LEFT JOIN conferencias_estoque c ON c.id = a.conferencia_id
     LEFT JOIN usuarios uc ON uc.id = a.criado_por
     LEFT JOIN usuarios ua ON ua.id = a.atualizado_por
     LEFT JOIN usuarios ur ON ur.id = a.resolvido_por
     ${clause}
     ORDER BY
       CASE a.status
         WHEN 'pendente' THEN 0
         WHEN 'em_analise' THEN 1
         ELSE 2
       END,
       a.criado_em DESC,
       a.id DESC`,
    params,
  );
  return rows.map(mapAnomaly);
}

async function getSummary(filters = {}) {
  const { clause, params } = buildListWhere(filters);
  const [rows] = await pool.query(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN status = 'pendente' THEN 1 ELSE 0 END) AS pendentes,
       SUM(CASE WHEN status = 'em_analise' THEN 1 ELSE 0 END) AS em_analise,
       SUM(CASE WHEN status = 'corrigida' THEN 1 ELSE 0 END) AS corrigidas,
       SUM(CASE WHEN status = 'ignorada' THEN 1 ELSE 0 END) AS ignoradas,
       SUM(CASE WHEN tipo = 'falta' AND status IN ('pendente', 'em_analise') THEN 1 ELSE 0 END) AS faltas_abertas,
       SUM(CASE WHEN tipo = 'sobra' AND status IN ('pendente', 'em_analise') THEN 1 ELSE 0 END) AS sobras_abertas
     FROM conferencia_anomalias a
     ${clause}`,
    params,
  );
  const row = rows[0] || {};
  return {
    total: Number(row.total || 0),
    pendentes: Number(row.pendentes || 0),
    em_analise: Number(row.em_analise || 0),
    corrigidas: Number(row.corrigidas || 0),
    ignoradas: Number(row.ignoradas || 0),
    abertas: Number(row.pendentes || 0) + Number(row.em_analise || 0),
    faltas_abertas: Number(row.faltas_abertas || 0),
    sobras_abertas: Number(row.sobras_abertas || 0),
  };
}

async function updateStatus(id, { status, observacao }, usuarioId) {
  if (!STATUS.has(status)) {
    throw Object.assign(new Error("Status de anomalia invalido"), { status: 400 });
  }
  if (status === "ignorada" && !String(observacao || "").trim()) {
    throw Object.assign(new Error("Informe uma justificativa para ignorar a anomalia"), {
      status: 400,
    });
  }
  if (status === "corrigida" && !String(observacao || "").trim()) {
    throw Object.assign(new Error("Informe uma observacao para marcar como corrigida"), {
      status: 400,
    });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      "SELECT * FROM conferencia_anomalias WHERE id = ? LIMIT 1 FOR UPDATE",
      [id],
    );
    const anomaly = rows[0];
    if (!anomaly) {
      throw Object.assign(new Error("Anomalia nao encontrada"), { status: 404 });
    }
    if (FINAL_STATUS.has(anomaly.status)) {
      throw Object.assign(new Error("Anomalia ja finalizada para auditoria"), { status: 409 });
    }
    const allowed = ALLOWED_TRANSITIONS[anomaly.status];
    if (!allowed || !allowed.has(status)) {
      throw Object.assign(new Error("Transicao de status nao permitida"), { status: 400 });
    }

    await conn.query(
      `UPDATE conferencia_anomalias
       SET status = ?,
           resolucao_observacao = ?,
           atualizado_por = ?,
           resolvido_por = CASE WHEN ? IN ('corrigida', 'ignorada') THEN ? ELSE resolvido_por END,
           resolvido_em = CASE WHEN ? IN ('corrigida', 'ignorada') THEN NOW() ELSE resolvido_em END,
           atualizado_em = NOW()
       WHERE id = ?`,
      [
        status,
        observacao || null,
        usuarioId || null,
        status,
        usuarioId || null,
        status,
        id,
      ],
    );

    await insertHistory(conn, {
      anomaliaId: id,
      acao: "status_alterado",
      statusAnterior: anomaly.status,
      statusNovo: status,
      observacao,
      usuarioId,
    });

    await conn.commit();
    const rowsAfter = await list({ id });
    return rowsAfter[0] || null;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function getHistory(id) {
  const [rows] = await pool.query(
    `SELECT h.*, u.nome AS usuario_nome
     FROM conferencia_anomalia_historico h
     LEFT JOIN usuarios u ON u.id = h.usuario_id
     WHERE h.anomalia_id = ?
     ORDER BY h.criado_em ASC, h.id ASC`,
    [id],
  );
  return rows.map(mapHistory);
}

module.exports = {
  createFromConference,
  list,
  getSummary,
  updateStatus,
  getHistory,
};
