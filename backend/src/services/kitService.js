const { pool } = require("../database/connection");
const loteService = require("./loteService");
const usuarioService = require("./usuarioService");

const KIT_STATUSES = new Set([
  "pronto_para_retirada",
  "em_uso",
  "aguardando_recebimento",
  "kit_incompleto",
]);

function assertStatus(status) {
  if (!KIT_STATUSES.has(status)) {
    throw Object.assign(new Error("Status de kit invalido"), { status: 400 });
  }
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function validateUserCredentials(matricula, senha) {
  if (!matricula || !senha) {
    throw Object.assign(new Error("Matricula e senha sao obrigatorias"), { status: 400 });
  }

  const user = await usuarioService.validateCredentials(matricula, senha);
  if (!user) throw Object.assign(new Error("Matricula ou senha invalidos"), { status: 401 });
  if (user.error === "inactive") throw Object.assign(new Error("Usuario inativo"), { status: 403 });
  return user;
}

async function getKitForUpdate(conn, kitId) {
  const [rows] = await conn.query(
    `SELECT
       k.*,
       e.nome AS estoque_nome,
       u.nome AS responsavel_atual_nome
     FROM kits_caixa k
     INNER JOIN estoques e ON e.id = k.estoque_id
     LEFT JOIN usuarios u ON u.id = k.responsavel_atual_id
     WHERE k.id = ?
     LIMIT 1
     FOR UPDATE`,
    [kitId],
  );
  if (!rows.length) {
    throw Object.assign(new Error("Kit nao encontrado"), { status: 404 });
  }
  return rows[0];
}

async function getKitItems(conn, kitId, lock = false) {
  const [rows] = await conn.query(
    `SELECT
       ki.id,
       ki.kit_id,
       ki.produto_id,
       p.nome AS produto_nome,
       p.codigo_barras,
       p.unidade,
       ki.quantidade_padrao,
       ki.quantidade_atual,
       ki.criado_em,
       ki.atualizado_em
     FROM kit_itens ki
     INNER JOIN produtos p ON p.id = ki.produto_id
     WHERE ki.kit_id = ?
     ORDER BY p.nome ASC
     ${lock ? "FOR UPDATE" : ""}`,
    [kitId],
  );
  return rows;
}

async function insertKitMovement(conn, { kitId, estoqueId, usuarioId, tipo, observacao, itens }) {
  const [mov] = await conn.query(
    `INSERT INTO kit_movimentacoes
       (kit_id, estoque_id, usuario_id, tipo, observacao, criado_em)
     VALUES (?, ?, ?, ?, ?, NOW())`,
    [kitId, estoqueId, usuarioId, tipo, observacao || null],
  );

  for (const item of itens || []) {
    await conn.query(
      `INSERT INTO kit_movimentacao_itens
        (kit_movimentacao_id, produto_id, quantidade_anterior, reposicao_operacao, quantidade_movimentada, quantidade_final)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        mov.insertId,
        item.produto_id,
        item.quantidade_anterior,
        item.reposicao_operacao || 0,
        item.quantidade_movimentada,
        item.quantidade_final,
      ],
    );
  }

  return mov.insertId;
}

async function assertProductsLinkedToStock(conn, estoqueId, items) {
  const productIds = [...new Set(items.map((item) => Number(item.produto_id)).filter(Boolean))];
  if (!productIds.length) {
    throw Object.assign(new Error("Adicione pelo menos um produto ao kit"), { status: 400 });
  }

  const [rows] = await conn.query(
    `SELECT ep.produto_id
     FROM estoque_produtos ep
     INNER JOIN produtos p ON p.id = ep.produto_id
     WHERE ep.estoque_id = ?
       AND ep.produto_id IN (${productIds.map(() => "?").join(",")})
       AND p.ativo = 1`,
    [estoqueId, ...productIds],
  );
  const linked = new Set(rows.map((row) => Number(row.produto_id)));
  const missing = productIds.filter((id) => !linked.has(id));
  if (missing.length) {
    throw Object.assign(
      new Error("Este produto nao esta vinculado ao estoque selecionado."),
      { status: 400 },
    );
  }
}

async function consumeStock(conn, produtoId, estoqueId, quantidade) {
  const stockProduct = await loteService.getStockProduct(conn, produtoId, estoqueId, true);
  if (!stockProduct) {
    throw Object.assign(
      new Error("Este produto nao esta vinculado ao estoque selecionado."),
      { status: 400 },
    );
  }

  await loteService.ensureDefaultLotFromCache(conn, stockProduct);
  const saldo = await loteService.recalcStockProduct(conn, stockProduct.estoque_produto_id);
  if (saldo < quantidade) {
    throw Object.assign(new Error("Estoque insuficiente no estoque selecionado."), {
      status: 400,
    });
  }

  let restante = quantidade;
  const [lots] = await conn.query(
    `SELECT id, quantidade
     FROM produto_lotes
     WHERE estoque_produto_id = ? AND quantidade > 0
     ORDER BY
       CASE WHEN data_validade IS NULL THEN 1 ELSE 0 END,
       data_validade ASC,
       lote ASC
     FOR UPDATE`,
    [stockProduct.estoque_produto_id],
  );

  for (const lot of lots) {
    if (restante <= 0) break;
    const current = toNumber(lot.quantidade);
    const remove = Math.min(current, restante);
    await conn.query("UPDATE produto_lotes SET quantidade = ?, atualizado_em = NOW() WHERE id = ?", [
      current - remove,
      lot.id,
    ]);
    restante -= remove;
  }

  if (restante > 0.0001) {
    throw Object.assign(new Error("Estoque insuficiente no estoque selecionado."), {
      status: 400,
    });
  }

  await loteService.recalcStockProduct(conn, stockProduct.estoque_produto_id);
}

function calculateKitStatus(items) {
  return items.every(
    (item) => toNumber(item.quantidade_atual) >= toNumber(item.quantidade_padrao),
  )
    ? "pronto_para_retirada"
    : "kit_incompleto";
}

async function listar({ estoque_id } = {}) {
  const params = [];
  const where = [];
  if (estoque_id && estoque_id !== "all") {
    where.push("k.estoque_id = ?");
    params.push(Number(estoque_id));
  }

  const [rows] = await pool.query(
    `SELECT
       k.id,
       k.estoque_id,
       e.nome AS estoque_nome,
       k.nome,
       k.status,
       k.responsavel_atual_id,
       u.nome AS responsavel_atual_nome,
       k.criado_em,
       k.atualizado_em,
       lm.tipo AS ultima_movimentacao_tipo,
       lm.criado_em AS ultima_movimentacao_em
     FROM kits_caixa k
     INNER JOIN estoques e ON e.id = k.estoque_id
     LEFT JOIN usuarios u ON u.id = k.responsavel_atual_id
     LEFT JOIN kit_movimentacoes lm ON lm.id = (
       SELECT km.id
       FROM kit_movimentacoes km
       WHERE km.kit_id = k.id
       ORDER BY km.criado_em DESC, km.id DESC
       LIMIT 1
     )
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY e.nome ASC, k.nome ASC`,
    params,
  );

  return rows;
}

async function buscar(id) {
  const conn = pool;
  const [kits] = await conn.query(
    `SELECT
       k.*,
       e.nome AS estoque_nome,
       u.nome AS responsavel_atual_nome
     FROM kits_caixa k
     INNER JOIN estoques e ON e.id = k.estoque_id
     LEFT JOIN usuarios u ON u.id = k.responsavel_atual_id
     WHERE k.id = ?
     LIMIT 1`,
    [id],
  );
  if (!kits.length) return null;
  const itens = await getKitItems(conn, id);
  return { ...kits[0], itens };
}

async function criar({ estoque_id, nome, itens, usuario_id }) {
  const estoqueId = Number(estoque_id);
  if (!estoqueId) throw Object.assign(new Error("estoque_id e obrigatorio"), { status: 400 });
  if (!String(nome || "").trim()) {
    throw Object.assign(new Error("Nome do kit e obrigatorio"), { status: 400 });
  }

  const normalizedItems = (itens || []).map((item) => ({
    produto_id: Number(item.produto_id),
    quantidade_padrao: toNumber(item.quantidade_padrao),
  }));
  if (!normalizedItems.length) {
    throw Object.assign(new Error("Adicione pelo menos um produto ao kit"), { status: 400 });
  }
  if (normalizedItems.some((item) => !item.produto_id || item.quantidade_padrao <= 0)) {
    throw Object.assign(new Error("Produtos do kit precisam ter quantidade maior que zero"), {
      status: 400,
    });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await assertProductsLinkedToStock(conn, estoqueId, normalizedItems);

    const [kit] = await conn.query(
      `INSERT INTO kits_caixa
        (estoque_id, nome, status, responsavel_atual_id, criado_em, atualizado_em)
       VALUES (?, ?, 'kit_incompleto', NULL, NOW(), NOW())`,
      [estoqueId, String(nome).trim()],
    );

    for (const item of normalizedItems) {
      await conn.query(
        `INSERT INTO kit_itens
          (kit_id, produto_id, quantidade_padrao, quantidade_atual, criado_em, atualizado_em)
         VALUES (?, ?, ?, 0, NOW(), NOW())`,
        [kit.insertId, item.produto_id, item.quantidade_padrao],
      );
    }

    await insertKitMovement(conn, {
      kitId: kit.insertId,
      estoqueId,
      usuarioId: usuario_id,
      tipo: "criacao",
      observacao: "Kit criado",
      itens: normalizedItems.map((item) => ({
        produto_id: item.produto_id,
        quantidade_anterior: 0,
        quantidade_movimentada: 0,
        quantidade_final: 0,
      })),
    });

    await conn.commit();
    return buscar(kit.insertId);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function atualizar({ kitId, nome, itens, usuario_id }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const kit = await getKitForUpdate(conn, kitId);
    if (kit.status === "em_uso") {
      throw Object.assign(new Error("Nao e permitido editar kit em uso"), { status: 400 });
    }

    const normalizedItems = (itens || []).map((item) => ({
      produto_id: Number(item.produto_id),
      quantidade_padrao: toNumber(item.quantidade_padrao),
    }));
    if (!normalizedItems.length) {
      throw Object.assign(new Error("Adicione pelo menos um produto ao kit"), { status: 400 });
    }
    if (normalizedItems.some((item) => !item.produto_id || item.quantidade_padrao <= 0)) {
      throw Object.assign(new Error("Produtos do kit precisam ter quantidade maior que zero"), {
        status: 400,
      });
    }
    await assertProductsLinkedToStock(conn, kit.estoque_id, normalizedItems);

    if (nome !== undefined && !String(nome).trim()) {
      throw Object.assign(new Error("Nome do kit e obrigatorio"), { status: 400 });
    }
    if (nome !== undefined) {
      await conn.query("UPDATE kits_caixa SET nome = ?, atualizado_em = NOW() WHERE id = ?", [
        String(nome).trim(),
        kitId,
      ]);
    }

    const currentItems = await getKitItems(conn, kitId, true);
    const currentByProduct = new Map(currentItems.map((item) => [Number(item.produto_id), item]));
    const nextIds = new Set(normalizedItems.map((item) => item.produto_id));

    for (const current of currentItems) {
      if (!nextIds.has(Number(current.produto_id))) {
        await conn.query("DELETE FROM kit_itens WHERE id = ?", [current.id]);
      }
    }

    for (const item of normalizedItems) {
      const current = currentByProduct.get(item.produto_id);
      if (current) {
        await conn.query(
          `UPDATE kit_itens
           SET quantidade_padrao = ?, quantidade_atual = LEAST(quantidade_atual, ?), atualizado_em = NOW()
           WHERE id = ?`,
          [item.quantidade_padrao, item.quantidade_padrao, current.id],
        );
      } else {
        await conn.query(
          `INSERT INTO kit_itens
            (kit_id, produto_id, quantidade_padrao, quantidade_atual, criado_em, atualizado_em)
           VALUES (?, ?, ?, 0, NOW(), NOW())`,
          [kitId, item.produto_id, item.quantidade_padrao],
        );
      }
    }

    const refreshed = await getKitItems(conn, kitId, true);
    const status = calculateKitStatus(refreshed);
    await conn.query("UPDATE kits_caixa SET status = ?, atualizado_em = NOW() WHERE id = ?", [
      status,
      kitId,
    ]);

    await insertKitMovement(conn, {
      kitId,
      estoqueId: kit.estoque_id,
      usuarioId: usuario_id,
      tipo: "ajuste",
      observacao: "Kit editado",
      itens: refreshed.map((item) => ({
        produto_id: item.produto_id,
        quantidade_anterior: item.quantidade_atual,
        quantidade_movimentada: 0,
        quantidade_final: item.quantidade_atual,
      })),
    });

    await conn.commit();
    return buscar(kitId);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function montarOuRepor({ kitId, usuario_id, tipo = "montagem", observacao }) {
  if (!["montagem", "reposicao"].includes(tipo)) {
    throw Object.assign(new Error("Tipo de montagem invalido"), { status: 400 });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const kit = await getKitForUpdate(conn, kitId);
    if (kit.status === "em_uso") {
      throw Object.assign(new Error("Nao e permitido montar ou repor kit em uso"), { status: 400 });
    }

    const items = await getKitItems(conn, kitId, true);
    const missing = items
      .map((item) => ({
        ...item,
        faltante: Math.max(0, toNumber(item.quantidade_padrao) - toNumber(item.quantidade_atual)),
      }))
      .filter((item) => item.faltante > 0);

    if (!missing.length) {
      await conn.query(
        "UPDATE kits_caixa SET status = 'pronto_para_retirada', atualizado_em = NOW() WHERE id = ?",
        [kitId],
      );
      await conn.commit();
      return buscar(kitId);
    }

    for (const item of missing) {
      await consumeStock(conn, item.produto_id, kit.estoque_id, item.faltante);
      await conn.query(
        "UPDATE kit_itens SET quantidade_atual = quantidade_atual + ?, atualizado_em = NOW() WHERE id = ?",
        [item.faltante, item.id],
      );
    }

    const refreshed = await getKitItems(conn, kitId, true);
    await conn.query(
      "UPDATE kits_caixa SET status = ?, atualizado_em = NOW() WHERE id = ?",
      [calculateKitStatus(refreshed), kitId],
    );

    await insertKitMovement(conn, {
      kitId,
      estoqueId: kit.estoque_id,
      usuarioId: usuario_id,
      tipo,
      observacao,
      itens: missing.map((item) => ({
        produto_id: item.produto_id,
        quantidade_anterior: item.quantidade_atual,
        quantidade_movimentada: item.faltante,
        quantidade_final: toNumber(item.quantidade_atual) + item.faltante,
      })),
    });

    await conn.commit();
    return buscar(kitId);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function retirar({ kitId, matricula, senha, observacao }) {
  const usuario = await validateUserCredentials(matricula, senha);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const kit = await getKitForUpdate(conn, kitId);
    if (kit.status !== "pronto_para_retirada") {
      throw Object.assign(new Error("Kit nao esta pronto para retirada"), { status: 400 });
    }

    await conn.query(
      `UPDATE kits_caixa
       SET status = 'em_uso', responsavel_atual_id = ?, atualizado_em = NOW()
       WHERE id = ?`,
      [usuario.id, kitId],
    );

    const items = await getKitItems(conn, kitId);
    await insertKitMovement(conn, {
      kitId,
      estoqueId: kit.estoque_id,
      usuarioId: usuario.id,
      tipo: "retirada",
      observacao,
      itens: items.map((item) => ({
        produto_id: item.produto_id,
        quantidade_anterior: item.quantidade_atual,
        quantidade_movimentada: 0,
        quantidade_final: item.quantidade_atual,
      })),
    });

    await conn.commit();
    return buscar(kitId);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function receber({ kitId, matricula, senha, itens, observacao }) {
  const usuario = await validateUserCredentials(matricula, senha);
  const payloadByProduct = new Map(
    (itens || []).map((item) => [
      Number(item.produto_id),
      {
        quantidade_atual: toNumber(item.quantidade_atual),
        reposicao_operacao: toNumber(item.reposicao_operacao),
      },
    ]),
  );

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const kit = await getKitForUpdate(conn, kitId);
    if (kit.status !== "em_uso") {
      throw Object.assign(new Error("Kit nao esta em uso"), { status: 400 });
    }

    const currentItems = await getKitItems(conn, kitId, true);
    const movementItems = [];
    for (const item of currentItems) {
      if (!payloadByProduct.has(Number(item.produto_id))) {
        throw Object.assign(new Error("Informe a quantidade de todos os itens do kit"), {
          status: 400,
        });
      }
      const payload = payloadByProduct.get(Number(item.produto_id));
      const initialQuantity = toNumber(item.quantidade_atual);
      const finalQuantity = payload.quantidade_atual;
      const operationReplenishment = payload.reposicao_operacao;
      const calculatedConsumption = initialQuantity + operationReplenishment - finalQuantity;
      if (finalQuantity < 0 || operationReplenishment < 0 || calculatedConsumption < 0) {
        throw Object.assign(new Error("Quantidade recebida invalida"), { status: 400 });
      }

      await conn.query(
        "UPDATE kit_itens SET quantidade_atual = ?, atualizado_em = NOW() WHERE id = ?",
        [finalQuantity, item.id],
      );
      movementItems.push({
        produto_id: item.produto_id,
        quantidade_anterior: initialQuantity,
        reposicao_operacao: operationReplenishment,
        quantidade_movimentada: calculatedConsumption,
        quantidade_final: finalQuantity,
      });
    }

    const refreshed = await getKitItems(conn, kitId, true);
    const status = calculateKitStatus(refreshed);
    await conn.query(
      `UPDATE kits_caixa
       SET status = ?, responsavel_atual_id = NULL, atualizado_em = NOW()
       WHERE id = ?`,
      [status, kitId],
    );

    await insertKitMovement(conn, {
      kitId,
      estoqueId: kit.estoque_id,
      usuarioId: usuario.id,
      tipo: "recebimento",
      observacao,
      itens: movementItems,
    });

    await conn.commit();
    return buscar(kitId);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function historico({ estoque_id, kit_id } = {}) {
  const where = [];
  const params = [];
  if (estoque_id && estoque_id !== "all") {
    where.push("km.estoque_id = ?");
    params.push(Number(estoque_id));
  }
  if (kit_id) {
    where.push("km.kit_id = ?");
    params.push(Number(kit_id));
  }

  const [rows] = await pool.query(
    `SELECT
       km.id,
       km.kit_id,
       k.nome AS kit_nome,
       km.estoque_id,
       e.nome AS estoque_nome,
       km.usuario_id,
       u.nome AS usuario_nome,
       km.tipo,
       km.observacao,
       km.criado_em,
       kmi.produto_id,
       p.nome AS produto_nome,
       kmi.quantidade_anterior,
       kmi.reposicao_operacao,
       kmi.quantidade_movimentada,
       kmi.quantidade_final
     FROM kit_movimentacoes km
     INNER JOIN kits_caixa k ON k.id = km.kit_id
     INNER JOIN estoques e ON e.id = km.estoque_id
     INNER JOIN usuarios u ON u.id = km.usuario_id
     LEFT JOIN kit_movimentacao_itens kmi ON kmi.kit_movimentacao_id = km.id
     LEFT JOIN produtos p ON p.id = kmi.produto_id
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY km.criado_em DESC, km.id DESC, p.nome ASC
     LIMIT 1500`,
    params,
  );

  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row.id)) {
      grouped.set(row.id, {
        id: row.id,
        kit_id: row.kit_id,
        kit_nome: row.kit_nome,
        estoque_id: row.estoque_id,
        estoque_nome: row.estoque_nome,
        usuario_id: row.usuario_id,
        usuario_nome: row.usuario_nome,
        tipo: row.tipo,
        observacao: row.observacao,
        criado_em: row.criado_em,
        itens: [],
      });
    }
    if (row.produto_id) {
      grouped.get(row.id).itens.push({
        produto_id: row.produto_id,
        produto_nome: row.produto_nome,
        quantidade_anterior: row.quantidade_anterior,
        reposicao_operacao: row.reposicao_operacao,
        quantidade_movimentada: row.quantidade_movimentada,
        quantidade_final: row.quantidade_final,
      });
    }
  }

  return Array.from(grouped.values());
}

async function produtosDisponiveis(estoque_id) {
  if (!estoque_id || estoque_id === "all") return [];
  const [rows] = await pool.query(
    `SELECT
       p.id,
       p.codigo_barras,
       p.nome,
       p.unidade,
       p.categoria_id,
       c.nome AS categoria_nome,
       COALESCE(ep.estoque_atual, 0) AS estoque_atual
     FROM estoque_produtos ep
     INNER JOIN produtos p ON p.id = ep.produto_id
     LEFT JOIN categorias c ON c.id = p.categoria_id
     WHERE ep.estoque_id = ?
       AND p.ativo = 1
     ORDER BY p.nome ASC`,
    [Number(estoque_id)],
  );
  return rows;
}

module.exports = {
  listar,
  buscar,
  criar,
  atualizar,
  montarOuRepor,
  retirar,
  receber,
  historico,
  produtosDisponiveis,
  assertStatus,
};
