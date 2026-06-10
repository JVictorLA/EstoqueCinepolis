const { pool } = require("../database/connection");
const loteService = require("./loteService");
const configuracaoService = require("./configuracaoService");

const ADJUSTMENT_REASONS = new Set([
  "Contagem fisica / inventario",
  "Correcao de lancamento",
  "Produto encontrado no estoque",
  "Erro de cadastro de saldo",
  "Ajuste administrativo",
  "Outro",
]);

function parseBooleanConfig(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "sim", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "nao", "não", "no", "off"].includes(normalized)) return false;
  return fallback;
}

async function getMovementRules(conn) {
  const bloquearSaidaProdutoVencido = await configuracaoService.getConfig(
    "bloquear_saida_produto_vencido",
    conn,
  );
  const registrarVencidoAoTentarRetirar = await configuracaoService.getConfig(
    "registrar_vencido_ao_tentar_retirar",
    conn,
  );
  const permitirIgnorarFefo = await configuracaoService.getConfig("permitir_ignorar_fefo", conn);
  const exigirJustificativaFefo = await configuracaoService.getConfig(
    "exigir_justificativa_fefo",
    conn,
  );

  return {
    bloquearSaidaProdutoVencido: parseBooleanConfig(bloquearSaidaProdutoVencido, true),
    registrarVencidoAoTentarRetirar: parseBooleanConfig(registrarVencidoAoTentarRetirar, true),
    permitirIgnorarFefo: parseBooleanConfig(permitirIgnorarFefo, true),
    exigirJustificativaFefo: parseBooleanConfig(exigirJustificativaFefo, true),
  };
}

function isExpiredLot(lot) {
  if (!lot?.data_validade) return false;
  const expiration = new Date(`${String(lot.data_validade).slice(0, 10)}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return !Number.isNaN(expiration.getTime()) && expiration < today;
}

function assertLotCanLeave(lot, rules) {
  if (rules.bloquearSaidaProdutoVencido && isExpiredLot(lot)) {
    throw Object.assign(
      new Error(
        `Saida bloqueada: o lote ${loteService.displayLotCode(lot.lote)} esta vencido desde ${String(lot.data_validade).slice(0, 10)}.`,
      ),
      { status: 400 },
    );
  }
}

async function getExpiredWasteReason(conn) {
  const [motivos] = await conn.query(
    "SELECT id, nome FROM motivos_desperdicio WHERE nome = 'Produto vencido' AND ativo = 1 LIMIT 1",
  );
  if (!motivos.length) {
    throw Object.assign(new Error("Motivo 'Produto vencido' nao encontrado"), {
      status: 400,
    });
  }
  return motivos[0];
}

async function registrarLoteVencidoComoDesperdicio({
  conn,
  produto,
  atual,
  estoqueId,
  usuario,
  loteRow,
}) {
  const quantidade = Number(loteRow.quantidade || 0);
  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    throw Object.assign(new Error("Saldo insuficiente neste lote."), { status: 400 });
  }

  const motivo = await getExpiredWasteReason(conn);
  const estoqueAntes = await loteService.recalcStockProduct(conn, atual.estoque_produto_id);
  const valorUnitario = Number(atual.preco_venda || produto.preco_venda || 0);
  const valorTotal = Number((quantidade * valorUnitario).toFixed(2));

  await conn.query("UPDATE produto_lotes SET quantidade = 0, atualizado_em = NOW() WHERE id = ?", [
    loteRow.id,
  ]);

  const estoqueDepois = await loteService.recalcStockProduct(conn, atual.estoque_produto_id);
  await conn.query("UPDATE produtos SET atualizado_em = NOW() WHERE id = ?", [produto.id]);

  const [desperdicio] = await conn.query(
    `INSERT INTO desperdicios
      (estoque_id, produto_id, usuario_id, motivo_id, quantidade,
       estoque_antes, estoque_depois, valor_unitario, valor_total, lote_id, lote_codigo, criado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      estoqueId,
      produto.id,
      usuario.id,
      motivo.id,
      quantidade,
      estoqueAntes,
      estoqueDepois,
      valorUnitario,
      valorTotal,
      loteRow.id,
      loteRow.lote,
    ],
  );

  const [movimentacao] = await conn.query(
    `INSERT INTO movimentacoes
      (estoque_id, produto_id, usuario_id, tipo, quantidade,
       estoque_antes, estoque_depois,
       usuario_nome, produto_nome, observacao, criado_em)
     VALUES (?, ?, ?, 'desperdicio', ?, ?, ?, ?, ?, ?, NOW())`,
    [
      estoqueId,
      produto.id,
      usuario.id,
      quantidade,
      estoqueAntes,
      estoqueDepois,
      usuario.nome,
      atual.produto_nome,
      `Desperdicio: ${motivo.nome}`,
    ],
  );

  await loteService.insertMovementLot(conn, {
    movimentacaoId: movimentacao.insertId,
    loteId: loteRow.id,
    quantidade,
  });

  const alerta_criado = await atualizarAlertasEstoque(
    conn,
    produto.id,
    estoqueId,
    estoqueDepois,
    atual.estoque_minimo,
  );

  return {
    bloqueado_vencido: true,
    desperdicio_automatico: true,
    message:
      "Este lote está vencido. A saída foi bloqueada e o lote foi registrado automaticamente como desperdício.",
    desperdicio_id: desperdicio.insertId,
    movimentacao_id: movimentacao.insertId,
    produto_id: produto.id,
    usuario_id: usuario.id,
    estoque_id: estoqueId,
    tipo: "desperdicio",
    motivo: motivo.nome,
    quantidade,
    estoque_antes: estoqueAntes,
    estoque_depois: estoqueDepois,
    valor_unitario: valorUnitario,
    valor_total: valorTotal,
    usuario_nome: usuario.nome,
    produto_nome: atual.produto_nome,
    lote_id: loteRow.id,
    lote_codigo: loteService.displayLotCode(loteRow.lote),
    alerta_criado,
  };
}

function assertFefoAllowed(fefo, rules, confirmarIgnorarFefo, justificativaFefo) {
  if (!fefo) return false;
  const fefoPayload = {
    ...fefo,
    permitir_ignorar_fefo: rules.permitirIgnorarFefo,
    exigir_justificativa_fefo: rules.exigirJustificativaFefo,
    permitirIgnorarFefo: rules.permitirIgnorarFefo,
    exigirJustificativaFefo: rules.exigirJustificativaFefo,
  };

  if (!rules.permitirIgnorarFefo) {
    throw Object.assign(new Error("Nao e permitido ignorar a ordem FEFO"), {
      status: 409,
      fefo: fefoPayload,
    });
  }

  if (!confirmarIgnorarFefo) {
    throw Object.assign(new Error(fefo.mensagem), { status: 409, fefo: fefoPayload });
  }

  if (rules.exigirJustificativaFefo && !String(justificativaFefo || "").trim()) {
    throw Object.assign(new Error("Justificativa FEFO obrigatoria"), {
      status: 400,
      fefo: fefoPayload,
    });
  }

  return true;
}

async function atualizarAlertasEstoque(conn, produtoId, estoqueId, estoqueAtual, estoqueMinimo) {
  if (Number(estoqueMinimo) > 0 && estoqueAtual <= Number(estoqueMinimo)) {
    const [openAlerts] = await conn.query(
      `SELECT id
       FROM alertas_estoque
       WHERE produto_id = ? AND estoque_id = ? AND resolvido = 0
       LIMIT 1`,
      [produtoId, estoqueId],
    );

    if (!openAlerts.length) {
      await conn.query(
        `INSERT INTO alertas_estoque
          (estoque_id, produto_id, tipo, resolvido, criado_em)
         VALUES (?, ?, 'baixo_estoque', 0, NOW())`,
        [estoqueId, produtoId],
      );
      return true;
    }

    return false;
  }

  await conn.query(
    `UPDATE alertas_estoque
     SET resolvido = 1
     WHERE produto_id = ? AND estoque_id = ? AND resolvido = 0`,
    [produtoId, estoqueId],
  );

  return false;
}

async function registrarMovimentacao({
  produto,
  estoque_id,
  usuario,
  tipo,
  quantidade,
  observacao,
  lote,
  data_validade,
  confirmar_ignorar_fefo,
  justificativa_fefo,
}) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const rules = await getMovementRules(conn);

    const atual =
      tipo === "entrada"
        ? await loteService.ensureStockProduct(conn, produto.id, estoque_id)
        : await loteService.getStockProduct(conn, produto.id, estoque_id, true);

    if (!atual) {
      throw Object.assign(new Error("Produto nao vinculado ao estoque"), { status: 404 });
    }
    if (!atual.ativo) {
      throw Object.assign(new Error("Produto inativo"), { status: 400 });
    }

    await loteService.ensureDefaultLotFromCache(conn, atual);
    const estoque_antes = await loteService.recalcStockProduct(conn, atual.estoque_produto_id);

    let estoque_depois;
    let loteMovimentado;
    let ignorouFefo = false;

    if (tipo === "entrada") {
      const validade = await loteService.resolveLotValidity(
        atual.categoria_id,
        data_validade,
        conn,
      );
      loteMovimentado = await loteService.upsertLot(conn, atual.estoque_produto_id, {
        lote,
        data_validade: validade,
        quantidade,
        categoria_id: atual.categoria_id,
      });
      estoque_depois = estoque_antes + quantidade;
    } else if (tipo === "saida") {
      loteMovimentado = await loteService.resolveLotForStockProduct(
        conn,
        atual,
        lote,
        true,
      );
      if (
        rules.bloquearSaidaProdutoVencido &&
        rules.registrarVencidoAoTentarRetirar &&
        isExpiredLot(loteMovimentado)
      ) {
        const result = await registrarLoteVencidoComoDesperdicio({
          conn,
          produto,
          atual,
          estoqueId: estoque_id,
          usuario,
          loteRow: loteMovimentado,
        });
        await conn.commit();
        return result;
      }
      assertLotCanLeave(loteMovimentado, rules);

      const loteAntes = Number(loteMovimentado.quantidade);
      if (loteAntes - quantidade < 0) {
        throw Object.assign(new Error("Saldo insuficiente neste estoque."), {
          status: 400,
        });
      }

      const fefo = await loteService.getFefoWarning(conn, atual.estoque_produto_id, loteMovimentado);
      ignorouFefo = assertFefoAllowed(fefo, rules, confirmar_ignorar_fefo, justificativa_fefo);

      await conn.query(
        "UPDATE produto_lotes SET quantidade = ?, atualizado_em = NOW() WHERE id = ?",
        [loteAntes - quantidade, loteMovimentado.id],
      );
      estoque_depois = estoque_antes - quantidade;
    } else {
      throw Object.assign(new Error("Tipo invalido"), { status: 400 });
    }

    estoque_depois = await loteService.recalcStockProduct(conn, atual.estoque_produto_id);

    await conn.query("UPDATE produtos SET atualizado_em = NOW() WHERE id = ?", [produto.id]);

    const [insMov] = await conn.query(
      `INSERT INTO movimentacoes
        (estoque_id, produto_id, usuario_id, tipo, quantidade,
         estoque_antes, estoque_depois,
         usuario_nome, produto_nome, observacao, criado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        estoque_id,
        produto.id,
        usuario.id,
        tipo,
        quantidade,
        estoque_antes,
        estoque_depois,
        usuario.nome,
        atual.produto_nome,
        observacao || null,
      ],
    );

    await loteService.insertMovementLot(conn, {
      movimentacaoId: insMov.insertId,
      loteId: loteMovimentado.id,
      quantidade,
      ignorouFefo,
      justificativaFefo: justificativa_fefo,
    });

    const alerta_criado = await atualizarAlertasEstoque(
      conn,
      produto.id,
      estoque_id,
      estoque_depois,
      atual.estoque_minimo,
    );

    await conn.commit();

    return {
      id: insMov.insertId,
      produto_id: produto.id,
      usuario_id: usuario.id,
      estoque_id,
      estoque_nome: produto.estoque_nome || null,
      tipo,
      quantidade,
      estoque_antes,
      estoque_depois,
      usuario_nome: usuario.nome,
      produto_nome: atual.produto_nome,
      observacao: observacao || null,
      alerta_criado,
      lote_id: loteMovimentado.id,
      lote_codigo: loteService.displayLotCode(loteMovimentado.lote),
      ignorou_fefo: ignorouFefo,
    };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function transferirEstoque({
  produto,
  estoque_origem_id,
  estoque_destino_id,
  usuario,
  quantidade,
  observacao,
  lote,
  confirmar_ignorar_fefo,
  justificativa_fefo,
}) {
  if (Number(estoque_origem_id) === Number(estoque_destino_id)) {
    throw Object.assign(new Error("Escolha um estoque de destino diferente da origem"), {
      status: 400,
    });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const rules = await getMovementRules(conn);

    const [destinoRows] = await conn.query(
      "SELECT id, nome, ativo FROM estoques WHERE id = ? LIMIT 1",
      [estoque_destino_id],
    );

    if (!destinoRows.length) {
      throw Object.assign(new Error("Estoque de destino nao encontrado"), {
        status: 404,
      });
    }
    if (!destinoRows[0].ativo) {
      throw Object.assign(new Error("Estoque de destino inativo"), {
        status: 400,
      });
    }

    const origem = await loteService.getStockProduct(conn, produto.id, estoque_origem_id, true);

    if (!origem) {
      throw Object.assign(new Error("Produto nao vinculado ao estoque de origem"), {
        status: 404,
      });
    }

    await loteService.ensureDefaultLotFromCache(conn, origem);
    const loteOrigem = await loteService.resolveLotForStockProduct(
      conn,
      origem,
      lote,
      true,
    );
    assertLotCanLeave(loteOrigem, rules);

    const origemAntes = await loteService.recalcStockProduct(conn, origem.estoque_produto_id);
    const origemDepois = origemAntes - quantidade;

    if (origemDepois < 0 || Number(loteOrigem.quantidade) - quantidade < 0) {
      throw Object.assign(new Error("Saldo insuficiente neste estoque."), {
        status: 400,
      });
    }

    const fefo = await loteService.getFefoWarning(conn, origem.estoque_produto_id, loteOrigem);
    const ignorouFefo = assertFefoAllowed(
      fefo,
      rules,
      confirmar_ignorar_fefo,
      justificativa_fefo,
    );

    const destinoProduto = await loteService.ensureStockProduct(conn, produto.id, estoque_destino_id);
    const destinoAntes = await loteService.recalcStockProduct(
      conn,
      destinoProduto.estoque_produto_id,
    );
    const destinoDepois = destinoAntes + quantidade;
    const destinoNome = destinoRows[0].nome;

    await conn.query(
      "UPDATE produto_lotes SET quantidade = ?, atualizado_em = NOW() WHERE id = ?",
      [Number(loteOrigem.quantidade) - quantidade, loteOrigem.id],
    );

    const loteDestino = await loteService.upsertLot(conn, destinoProduto.estoque_produto_id, {
      lote: loteOrigem.lote,
      data_validade: loteOrigem.data_validade,
      quantidade,
      categoria_id: destinoProduto.categoria_id,
    });

    const origemDepoisRecalc = await loteService.recalcStockProduct(conn, origem.estoque_produto_id);
    const destinoDepoisRecalc = await loteService.recalcStockProduct(
      conn,
      destinoProduto.estoque_produto_id,
    );

    await conn.query("UPDATE produtos SET atualizado_em = NOW() WHERE id = ?", [produto.id]);

    const notaOrigem = [`Transferencia para ${destinoNome}`, observacao || null]
      .filter(Boolean)
      .join(" - ");

    const notaDestino = [`Transferencia de ${origem.estoque_nome}`, observacao || null]
      .filter(Boolean)
      .join(" - ");

    const [saida] = await conn.query(
      `INSERT INTO movimentacoes
        (estoque_id, produto_id, usuario_id, tipo, quantidade,
         estoque_antes, estoque_depois,
         usuario_nome, produto_nome, observacao, criado_em)
       VALUES (?, ?, ?, 'saida', ?, ?, ?, ?, ?, ?, NOW())`,
      [
        estoque_origem_id,
        produto.id,
        usuario.id,
        quantidade,
        origemAntes,
        origemDepoisRecalc,
        usuario.nome,
        origem.produto_nome,
        notaOrigem,
      ],
    );

    const [entrada] = await conn.query(
      `INSERT INTO movimentacoes
        (estoque_id, produto_id, usuario_id, tipo, quantidade,
         estoque_antes, estoque_depois,
         usuario_nome, produto_nome, observacao, criado_em)
       VALUES (?, ?, ?, 'entrada', ?, ?, ?, ?, ?, ?, NOW())`,
      [
        estoque_destino_id,
        produto.id,
        usuario.id,
        quantidade,
        destinoAntes,
        destinoDepoisRecalc,
        usuario.nome,
        origem.produto_nome,
        notaDestino,
      ],
    );

    await loteService.insertMovementLot(conn, {
      movimentacaoId: saida.insertId,
      loteId: loteOrigem.id,
      quantidade,
      ignorouFefo,
      justificativaFefo: justificativa_fefo,
    });
    await loteService.insertMovementLot(conn, {
      movimentacaoId: entrada.insertId,
      loteId: loteDestino.id,
      quantidade,
    });

    await atualizarAlertasEstoque(
      conn,
      produto.id,
      estoque_origem_id,
      origemDepoisRecalc,
      origem.estoque_minimo,
    );

    await atualizarAlertasEstoque(
      conn,
      produto.id,
      estoque_destino_id,
      destinoDepoisRecalc,
      destinoProduto.estoque_minimo,
    );

    await conn.commit();

    return {
      saida_id: saida.insertId,
      entrada_id: entrada.insertId,
      produto_id: produto.id,
      produto_nome: origem.produto_nome,
      estoque_origem_id,
      estoque_origem_nome: origem.estoque_nome,
      estoque_destino_id,
      estoque_destino_nome: destinoNome,
      quantidade,
      usuario_id: usuario.id,
      usuario_nome: usuario.nome,
      lote_id: loteOrigem.id,
      lote_codigo: loteService.displayLotCode(loteOrigem.lote),
      ignorou_fefo: ignorouFefo,
    };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function getDefaultAdjustmentLot(conn, stockProduct) {
  const [rows] = await conn.query(
    `SELECT *
     FROM produto_lotes
     WHERE estoque_produto_id = ? AND lote = ?
     LIMIT 1
     FOR UPDATE`,
    [stockProduct.estoque_produto_id, loteService.DEFAULT_LOT_CODE],
  );
  if (rows.length) return rows[0];

  const [result] = await conn.query(
    `INSERT INTO produto_lotes
       (estoque_produto_id, lote, data_validade, quantidade, criado_em, atualizado_em)
     VALUES (?, ?, NULL, 0, NOW(), NOW())`,
    [stockProduct.estoque_produto_id, loteService.DEFAULT_LOT_CODE],
  );

  return {
    id: result.insertId,
    estoque_produto_id: stockProduct.estoque_produto_id,
    lote: loteService.DEFAULT_LOT_CODE,
    data_validade: null,
    quantidade: 0,
  };
}

async function getAdjustmentLot(conn, stockProduct, loteId) {
  const [[category]] = await conn.query(
    "SELECT COALESCE(exige_validade, 0) AS exige_validade FROM categorias WHERE id = ? LIMIT 1",
    [stockProduct.categoria_id],
  );
  const requiresValidity = !!category?.exige_validade;

  if (requiresValidity && !Number(loteId)) {
    throw Object.assign(new Error("Selecione o lote do produto"), { status: 400 });
  }

  if (Number(loteId)) {
    const [rows] = await conn.query(
      `SELECT *
       FROM produto_lotes
       WHERE id = ? AND estoque_produto_id = ?
       LIMIT 1
       FOR UPDATE`,
      [Number(loteId), stockProduct.estoque_produto_id],
    );
    if (!rows.length) {
      throw Object.assign(new Error("Lote nao encontrado neste estoque"), { status: 404 });
    }
    return rows[0];
  }

  return getDefaultAdjustmentLot(conn, stockProduct);
}

async function ajustarEstoque({ usuario, itens }) {
  const normalizedItems = (itens || [])
    .map((item) => ({
      produto_id: Number(item.produto_id),
      estoque_id: Number(item.estoque_id),
      lote_id: item.lote_id === undefined || item.lote_id === null || item.lote_id === "" ? null : Number(item.lote_id),
      quantidade_final: Number(item.quantidade_final),
      motivo: String(item.motivo || "").trim(),
    }))
    .filter((item) => item.produto_id || item.estoque_id || item.motivo || Number.isFinite(item.quantidade_final));

  if (!normalizedItems.length) {
    throw Object.assign(new Error("Informe pelo menos um ajuste"), { status: 400 });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const results = [];

    for (const item of normalizedItems) {
      if (!item.produto_id) throw Object.assign(new Error("Produto e obrigatorio"), { status: 400 });
      if (!item.estoque_id) throw Object.assign(new Error("Estoque e obrigatorio"), { status: 400 });
      if (!Number.isFinite(item.quantidade_final) || item.quantidade_final < 0) {
        throw Object.assign(new Error("Quantidade final invalida"), { status: 400 });
      }
      if (!ADJUSTMENT_REASONS.has(item.motivo)) {
        throw Object.assign(new Error("Motivo do ajuste invalido"), { status: 400 });
      }

      const stockProduct = await loteService.getStockProduct(
        conn,
        item.produto_id,
        item.estoque_id,
        true,
      );
      if (!stockProduct) {
        throw Object.assign(new Error("Produto nao vinculado ao estoque selecionado"), {
          status: 400,
        });
      }
      if (!stockProduct.ativo) {
        throw Object.assign(new Error("Produto inativo"), { status: 400 });
      }

      await loteService.ensureDefaultLotFromCache(conn, stockProduct);
      const lote = await getAdjustmentLot(conn, stockProduct, item.lote_id);
      const estoqueAntes = await loteService.recalcStockProduct(conn, stockProduct.estoque_produto_id);
      const loteAntes = Number(lote.quantidade || 0);

      await conn.query(
        "UPDATE produto_lotes SET quantidade = ?, atualizado_em = NOW() WHERE id = ?",
        [item.quantidade_final, lote.id],
      );

      const estoqueDepois = await loteService.recalcStockProduct(
        conn,
        stockProduct.estoque_produto_id,
      );
      const quantidadeMovimentada = Math.abs(item.quantidade_final - loteAntes);

      await conn.query("UPDATE produtos SET atualizado_em = NOW() WHERE id = ?", [item.produto_id]);

      const [mov] = await conn.query(
        `INSERT INTO movimentacoes
          (estoque_id, produto_id, usuario_id, tipo, quantidade,
           estoque_antes, estoque_depois,
           usuario_nome, produto_nome, observacao, criado_em)
         VALUES (?, ?, ?, 'ajuste', ?, ?, ?, ?, ?, ?, NOW())`,
        [
          item.estoque_id,
          item.produto_id,
          usuario.id,
          quantidadeMovimentada,
          estoqueAntes,
          estoqueDepois,
          usuario.nome,
          stockProduct.produto_nome,
          `Ajuste de estoque: ${item.motivo}`,
        ],
      );

      await loteService.insertMovementLot(conn, {
        movimentacaoId: mov.insertId,
        loteId: lote.id,
        quantidade: quantidadeMovimentada,
      });

      const alerta_criado = await atualizarAlertasEstoque(
        conn,
        item.produto_id,
        item.estoque_id,
        estoqueDepois,
        stockProduct.estoque_minimo,
      );

      results.push({
        id: mov.insertId,
        produto_id: item.produto_id,
        usuario_id: usuario.id,
        estoque_id: item.estoque_id,
        estoque_nome: stockProduct.estoque_nome,
        tipo: "ajuste",
        quantidade: quantidadeMovimentada,
        estoque_antes: estoqueAntes,
        estoque_depois: estoqueDepois,
        usuario_nome: usuario.nome,
        produto_nome: stockProduct.produto_nome,
        observacao: `Ajuste de estoque: ${item.motivo}`,
        alerta_criado,
        lote_id: lote.id,
        lote_codigo: loteService.displayLotCode(lote.lote),
      });
    }

    await conn.commit();
    return results;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function listar(filtros = {}) {
  const where = [];
  const params = [];

  if (filtros.data_inicial) {
    where.push("m.criado_em >= ?");
    params.push(`${filtros.data_inicial} 00:00:00`);
  }
  if (filtros.data_final) {
    where.push("m.criado_em <= ?");
    params.push(`${filtros.data_final} 23:59:59`);
  }
  if (filtros.tipo) {
    where.push("m.tipo = ?");
    params.push(filtros.tipo);
  }
  if (filtros.categoria_id && filtros.categoria_id !== "all") {
    where.push("p.categoria_id = ?");
    params.push(filtros.categoria_id);
  }
  if (filtros.produto_id) {
    where.push("m.produto_id = ?");
    params.push(filtros.produto_id);
  }
  if (filtros.codigo_barras) {
    where.push("p.codigo_barras = ?");
    params.push(filtros.codigo_barras);
  }
  if (filtros.usuario_id) {
    where.push("m.usuario_id = ?");
    params.push(filtros.usuario_id);
  }
  if (filtros.estoque_id && filtros.estoque_id !== "all") {
    where.push("m.estoque_id = ?");
    params.push(filtros.estoque_id);
  }

  const sql = `
    SELECT
      m.id,
      m.estoque_id,
      m.produto_id,
      m.usuario_id,
      m.tipo,
      m.quantidade,
      m.estoque_antes,
      m.estoque_depois,
      m.usuario_nome,
      m.produto_nome,
      m.observacao,
      m.criado_em,
      p.codigo_barras,
      e.nome AS estoque_nome,
      ml.lote_id,
      pl.lote AS lote_codigo,
      COALESCE(ml.ignorou_fefo, 0) AS ignorou_fefo,
      ml.justificativa_fefo
    FROM movimentacoes m
    LEFT JOIN produtos p ON p.id = m.produto_id
    LEFT JOIN estoques e ON e.id = m.estoque_id
    LEFT JOIN movimentacao_lotes ml ON ml.movimentacao_id = m.id
    LEFT JOIN produto_lotes pl ON pl.id = ml.lote_id
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY m.criado_em DESC
    LIMIT 1000
  `;

  const [rows] = await pool.query(sql, params);
  return rows;
}

module.exports = {
  registrarMovimentacao,
  transferirEstoque,
  ajustarEstoque,
  listar,
  atualizarAlertasEstoque,
};
