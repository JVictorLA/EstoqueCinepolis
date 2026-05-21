const { pool } = require("../database/connection");
const loteService = require("./loteService");

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
      const loteAntes = Number(loteMovimentado.quantidade);
      if (loteAntes - quantidade < 0) {
        throw Object.assign(new Error("Saldo insuficiente neste estoque."), {
          status: 400,
        });
      }

      const fefo = await loteService.getFefoWarning(conn, atual.estoque_produto_id, loteMovimentado);
      if (fefo && !confirmar_ignorar_fefo) {
        throw Object.assign(new Error(fefo.mensagem), { status: 409, fefo });
      }
      if (fefo) {
        if (!String(justificativa_fefo || "").trim()) {
          throw Object.assign(new Error("Justificativa FEFO obrigatoria"), { status: 400 });
        }
        ignorouFefo = true;
      }

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
    const origemAntes = await loteService.recalcStockProduct(conn, origem.estoque_produto_id);
    const origemDepois = origemAntes - quantidade;

    if (origemDepois < 0 || Number(loteOrigem.quantidade) - quantidade < 0) {
      throw Object.assign(new Error("Saldo insuficiente neste estoque."), {
        status: 400,
      });
    }

    const fefo = await loteService.getFefoWarning(conn, origem.estoque_produto_id, loteOrigem);
    let ignorouFefo = false;
    if (fefo && !confirmar_ignorar_fefo) {
      throw Object.assign(new Error(fefo.mensagem), { status: 409, fefo });
    }
    if (fefo) {
      if (!String(justificativa_fefo || "").trim()) {
        throw Object.assign(new Error("Justificativa FEFO obrigatoria"), { status: 400 });
      }
      ignorouFefo = true;
    }

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
      COALESCE(ml.ignorou_fefo, 0) AS ignorou_fefo
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
  listar,
  atualizarAlertasEstoque,
};
