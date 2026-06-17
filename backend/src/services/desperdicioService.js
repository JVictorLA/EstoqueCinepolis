const { pool } = require("../database/connection");
const { atualizarAlertasEstoque } = require("./movimentacaoService");
const loteService = require("./loteService");

async function listarMotivosAtivos() {
  const [rows] = await pool.query(
    `SELECT id, nome, ativo, criado_em
     FROM motivos_desperdicio
     WHERE ativo = 1
     ORDER BY nome ASC`,
  );
  return rows;
}

function addFilters(filtros = {}) {
  const where = [];
  const params = [];

  if (filtros.estoque_id && filtros.estoque_id !== "all") {
    where.push("d.estoque_id = ?");
    params.push(filtros.estoque_id);
  }
  if (filtros.produto_id) {
    where.push("d.produto_id = ?");
    params.push(filtros.produto_id);
  }
  if (filtros.usuario_id) {
    where.push("d.usuario_id = ?");
    params.push(filtros.usuario_id);
  }
  if (filtros.motivo_id) {
    where.push("d.motivo_id = ?");
    params.push(filtros.motivo_id);
  }
  if (filtros.data_inicial) {
    where.push("d.criado_em >= ?");
    params.push(`${filtros.data_inicial} 00:00:00`);
  }
  if (filtros.data_final) {
    where.push("d.criado_em <= ?");
    params.push(`${filtros.data_final} 23:59:59`);
  }

  return {
    clause: where.length ? `WHERE ${where.join(" AND ")}` : "",
    params,
  };
}

async function criarRegistroDesperdicio(
  conn,
  { estoqueId, produtoRow, usuario, motivo, quantidade, loteRow },
) {
  const estoqueAntes = await loteService.recalcStockProduct(conn, produtoRow.estoque_produto_id);
  const estoqueDepois = estoqueAntes - quantidade;

  if (estoqueDepois < 0) {
    throw Object.assign(new Error("Saldo insuficiente neste estoque."), {
      status: 400,
    });
  }

  const valorUnitario = Number(produtoRow.preco_venda || 0);
  const valorTotal = Number((quantidade * valorUnitario).toFixed(2));

  const loteAntes = Number(loteRow.quantidade);
  if (loteAntes - quantidade < 0) {
    throw Object.assign(new Error("Saldo insuficiente neste lote."), { status: 400 });
  }

  await conn.query("UPDATE produto_lotes SET quantidade = ?, atualizado_em = NOW() WHERE id = ?", [
    loteAntes - quantidade,
    loteRow.id,
  ]);
  const estoqueDepoisRecalc = await loteService.recalcStockProduct(
    conn,
    produtoRow.estoque_produto_id,
  );

  await conn.query("UPDATE produtos SET atualizado_em = NOW() WHERE id = ?", [produtoRow.id]);

  const [desperdicio] = await conn.query(
    `INSERT INTO desperdicios
      (estoque_id, produto_id, usuario_id, motivo_id, quantidade,
       estoque_antes, estoque_depois, valor_unitario, valor_total, lote_id, lote_codigo, criado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      estoqueId,
      produtoRow.id,
      usuario.id,
      motivo.id,
      quantidade,
      estoqueAntes,
      estoqueDepoisRecalc,
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
      produtoRow.id,
      usuario.id,
      quantidade,
      estoqueAntes,
      estoqueDepoisRecalc,
      usuario.nome,
      produtoRow.nome,
      `Desperdicio: ${motivo.nome}`,
    ],
  );

  await loteService.insertMovementLot(conn, {
    movimentacaoId: movimentacao.insertId,
    loteId: loteRow.id,
    quantidade,
  });

  await atualizarAlertasEstoque(
    conn,
    produtoRow.id,
    estoqueId,
    estoqueDepoisRecalc,
    produtoRow.estoque_minimo,
  );

  return {
    id: desperdicio.insertId,
    estoque_id: estoqueId,
    produto_id: produtoRow.id,
    usuario_id: usuario.id,
    motivo_id: motivo.id,
    quantidade,
    estoque_antes: estoqueAntes,
    estoque_depois: estoqueDepoisRecalc,
    valor_unitario: valorUnitario,
    valor_total: valorTotal,
    usuario_nome: usuario.nome,
    produto_nome: produtoRow.nome,
    motivo_nome: motivo.nome,
    lote_id: loteRow.id,
    lote_codigo: loteService.displayLotCode(loteRow.lote),
  };
}

async function registrarManual({ estoque_id, codigo_barras, quantidade, motivo_id, usuario, lote }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [estoques] = await conn.query("SELECT id, ativo FROM estoques WHERE id = ? LIMIT 1", [
      estoque_id,
    ]);
    if (!estoques.length) {
      throw Object.assign(new Error("Estoque não encontrado"), { status: 404 });
    }
    if (!estoques[0].ativo) {
      throw Object.assign(new Error("Estoque inativo"), { status: 400 });
    }

    const [motivos] = await conn.query(
      "SELECT id, nome, ativo FROM motivos_desperdicio WHERE id = ? LIMIT 1",
      [motivo_id],
    );
    if (!motivos.length || !motivos[0].ativo) {
      throw Object.assign(new Error("Motivo de desperdício inválido"), { status: 400 });
    }

    const [produtos] = await conn.query(
      `SELECT
        p.id,
        p.nome,
        p.ativo,
        p.preco_venda,
        ep.id AS estoque_produto_id,
        p.categoria_id,
        ep.estoque_atual,
        ep.estoque_minimo
       FROM produtos p
       INNER JOIN estoque_produtos ep ON ep.produto_id = p.id
       WHERE p.codigo_barras = ? AND ep.estoque_id = ?
       LIMIT 1
       FOR UPDATE`,
      [codigo_barras, estoque_id],
    );

    if (!produtos.length) {
      throw Object.assign(new Error("Produto não encontrado neste estoque"), {
        status: 404,
      });
    }
    if (!produtos[0].ativo) {
      throw Object.assign(new Error("Produto inativo"), { status: 400 });
    }

    await loteService.ensureDefaultLotFromCache(conn, produtos[0]);
    const loteRow = await loteService.resolveLotForStockProduct(
      conn,
      produtos[0],
      lote,
      true,
    );

    const result = await criarRegistroDesperdicio(conn, {
      estoqueId: Number(estoque_id),
      produtoRow: produtos[0],
      usuario,
      motivo: motivos[0],
      quantidade,
      loteRow,
    });

    await conn.commit();
    return result;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function listar(filtros = {}) {
  const { clause, params } = addFilters(filtros);
  const [rows] = await pool.query(
    `SELECT
      d.id,
      d.estoque_id,
      COALESCE(e.nome, 'Estoque removido') AS estoque_nome,
      d.produto_id,
      COALESCE(p.nome, CONCAT('Produto #', d.produto_id)) AS produto_nome,
      p.codigo_barras,
      d.usuario_id,
      COALESCE(u.nome, 'Usuário removido') AS usuario_nome,
      u.matricula,
      d.motivo_id,
      COALESCE(m.nome, 'Motivo removido') AS motivo_nome,
      d.quantidade,
      d.estoque_antes,
      d.estoque_depois,
      d.valor_unitario,
      d.valor_total,
      d.lote_id,
      d.lote_codigo,
      d.criado_em
     FROM desperdicios d
     LEFT JOIN estoques e ON e.id = d.estoque_id
     LEFT JOIN produtos p ON p.id = d.produto_id
     LEFT JOIN usuarios u ON u.id = d.usuario_id
     LEFT JOIN motivos_desperdicio m ON m.id = d.motivo_id
     ${clause}
     ORDER BY d.criado_em DESC
     LIMIT 1000`,
    params,
  );
  return rows;
}

async function resumo(filtros = {}) {
  const { clause, params } = addFilters(filtros);
  const baseJoin = `
    FROM desperdicios d
    LEFT JOIN produtos p ON p.id = d.produto_id
    LEFT JOIN usuarios u ON u.id = d.usuario_id
    LEFT JOIN motivos_desperdicio m ON m.id = d.motivo_id
    LEFT JOIN estoques e ON e.id = d.estoque_id
    ${clause}
  `;

  const [[totais], [porDia], [porProduto], [porFuncionario], [porMotivo], [ranking]] =
    await Promise.all([
      pool.query(
        `SELECT
          COALESCE(SUM(d.valor_total), 0) AS valor_total,
          COALESCE(SUM(d.quantidade), 0) AS quantidade_total,
          COUNT(*) AS registros
         ${baseJoin}`,
        params,
      ),
      pool.query(
        `SELECT DATE(d.criado_em) AS dia,
          COALESCE(SUM(d.quantidade), 0) AS quantidade,
          COALESCE(SUM(d.valor_total), 0) AS valor_total
         ${baseJoin}
         GROUP BY DATE(d.criado_em)
         ORDER BY dia ASC`,
        params,
      ),
      pool.query(
        `SELECT d.produto_id, COALESCE(p.nome, CONCAT('Produto #', d.produto_id)) AS produto_nome,
          COALESCE(SUM(d.quantidade), 0) AS quantidade,
          COALESCE(SUM(d.valor_total), 0) AS valor_total
         ${baseJoin}
         GROUP BY d.produto_id, produto_nome
         ORDER BY valor_total DESC
         LIMIT 20`,
        params,
      ),
      pool.query(
        `SELECT d.usuario_id, COALESCE(u.nome, 'Usuário removido') AS usuario_nome,
          COALESCE(SUM(d.quantidade), 0) AS quantidade,
          COALESCE(SUM(d.valor_total), 0) AS valor_total
         ${baseJoin}
         GROUP BY d.usuario_id, usuario_nome
         ORDER BY valor_total DESC
         LIMIT 20`,
        params,
      ),
      pool.query(
        `SELECT d.motivo_id, COALESCE(m.nome, 'Motivo removido') AS motivo_nome,
          COUNT(*) AS registros,
          COALESCE(SUM(d.quantidade), 0) AS quantidade,
          COALESCE(SUM(d.valor_total), 0) AS valor_total
         ${baseJoin}
         GROUP BY d.motivo_id, motivo_nome
         ORDER BY registros DESC, valor_total DESC
         LIMIT 20`,
        params,
      ),
      pool.query(
        `SELECT d.id, d.criado_em,
          COALESCE(e.nome, 'Estoque removido') AS estoque_nome,
          COALESCE(p.nome, CONCAT('Produto #', d.produto_id)) AS produto_nome,
          COALESCE(u.nome, 'Usuário removido') AS usuario_nome,
          COALESCE(m.nome, 'Motivo removido') AS motivo_nome,
          d.quantidade,
          d.valor_total
         ${baseJoin}
         ORDER BY d.valor_total DESC, d.quantidade DESC
         LIMIT 10`,
        params,
      ),
    ]);

  return {
    totais: {
      valor_total: Number(totais[0]?.valor_total || 0),
      quantidade_total: Number(totais[0]?.quantidade_total || 0),
      registros: Number(totais[0]?.registros || 0),
    },
    por_dia: porDia,
    por_produto: porProduto,
    por_funcionario: porFuncionario,
    por_motivo: porMotivo,
    ranking,
  };
}

async function processarVencidos(usuario) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [motivos] = await conn.query(
      "SELECT id, nome FROM motivos_desperdicio WHERE nome = 'Produto vencido' AND ativo = 1 LIMIT 1",
    );
    if (!motivos.length) {
      throw Object.assign(new Error("Motivo 'Produto vencido' não encontrado"), {
        status: 400,
      });
    }

    const [vencidos] = await conn.query(
      `SELECT
        p.id,
        p.nome,
        p.preco_venda,
        ep.id AS estoque_produto_id,
        ep.estoque_id,
        ep.estoque_atual,
        ep.estoque_minimo,
        pl.id AS lote_id,
        pl.lote,
        pl.data_validade,
        pl.quantidade AS lote_quantidade
       FROM produto_lotes pl
       INNER JOIN estoque_produtos ep ON ep.id = pl.estoque_produto_id
       INNER JOIN produtos p ON p.id = ep.produto_id
       INNER JOIN categorias c ON c.id = p.categoria_id
       WHERE pl.data_validade < CURDATE()
         AND pl.quantidade > 0
         AND COALESCE(c.exige_validade, 0) = 1
       FOR UPDATE`,
    );

    const processados = [];
    for (const produto of vencidos) {
      processados.push(
        await criarRegistroDesperdicio(conn, {
          estoqueId: Number(produto.estoque_id),
          produtoRow: produto,
          usuario,
          motivo: motivos[0],
          quantidade: Number(produto.lote_quantidade),
          loteRow: {
            id: produto.lote_id,
            lote: produto.lote,
            quantidade: produto.lote_quantidade,
          },
        }),
      );
    }

    await conn.commit();
    return {
      processados: processados.length,
      itens: processados,
    };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

module.exports = {
  listarMotivosAtivos,
  registrarManual,
  listar,
  resumo,
  processarVencidos,
};
