const { pool } = require("../database/connection");

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

async function getMotivoProdutoVencido(conn) {
  const [rows] = await conn.query(
    "SELECT id, nome FROM motivos_desperdicio WHERE nome = 'Produto vencido' LIMIT 1",
  );

  if (rows.length) return rows[0];

  const [result] = await conn.query(
    "INSERT INTO motivos_desperdicio (nome, ativo, criado_em) VALUES ('Produto vencido', 1, NOW())",
  );

  return { id: result.insertId, nome: "Produto vencido" };
}

async function registrarDesperdicioPorVencimento(conn, { produtoRow, estoqueId, usuario }) {
  const estoqueAntes = Number(produtoRow.estoque_atual);
  const estoqueDepois = 0;
  const quantidade = estoqueAntes;
  const valorUnitario = Number(produtoRow.preco_venda || 0);
  const valorTotal = Number((quantidade * valorUnitario).toFixed(2));
  const motivo = await getMotivoProdutoVencido(conn);

  await conn.query(
    "UPDATE estoque_produtos SET estoque_atual = 0 WHERE produto_id = ? AND estoque_id = ?",
    [produtoRow.id, estoqueId],
  );

  await conn.query("UPDATE produtos SET atualizado_em = NOW() WHERE id = ?", [produtoRow.id]);

  const [desperdicio] = await conn.query(
    `INSERT INTO desperdicios
      (estoque_id, produto_id, usuario_id, motivo_id, quantidade,
       estoque_antes, estoque_depois, valor_unitario, valor_total, criado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      estoqueId,
      produtoRow.id,
      usuario.id,
      motivo.id,
      quantidade,
      estoqueAntes,
      estoqueDepois,
      valorUnitario,
      valorTotal,
    ],
  );

  await conn.query(
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
      estoqueDepois,
      usuario.nome,
      produtoRow.nome,
      "Desperdicio automatico: produto vencido e improprio para consumo",
    ],
  );

  await atualizarAlertasEstoque(
    conn,
    produtoRow.id,
    estoqueId,
    estoqueDepois,
    produtoRow.estoque_minimo,
  );

  return {
    id: desperdicio.insertId,
    produto_id: produtoRow.id,
    produto_nome: produtoRow.nome,
    usuario_id: usuario.id,
    usuario_nome: usuario.nome,
    estoque_id: estoqueId,
    motivo_id: motivo.id,
    motivo_nome: motivo.nome,
    quantidade,
    estoque_antes: estoqueAntes,
    estoque_depois: estoqueDepois,
    valor_unitario: valorUnitario,
    valor_total: valorTotal,
  };
}

async function registrarMovimentacao({
  produto,
  estoque_id,
  usuario,
  tipo,
  quantidade,
  observacao,
}) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT
        p.id,
        p.nome,
        p.preco_venda,
        ep.estoque_atual,
        ep.estoque_minimo,
        ep.data_validade,
        CASE
          WHEN COALESCE(c.exige_validade, 0) = 1
           AND ep.data_validade IS NOT NULL
           AND ep.data_validade < CURDATE()
          THEN 1 ELSE 0
        END AS vencido
       FROM produtos p
       LEFT JOIN categorias c ON c.id = p.categoria_id
       INNER JOIN estoque_produtos ep ON ep.produto_id = p.id
       WHERE p.id = ? AND ep.estoque_id = ?
       LIMIT 1
       FOR UPDATE`,
      [produto.id, estoque_id],
    );
    if (!rows.length) {
      throw Object.assign(new Error("Produto nao vinculado ao estoque"), {
        status: 404,
      });
    }

    const atual = rows[0];
    const estoque_antes = Number(atual.estoque_atual);

    let estoque_depois;
    if (tipo === "entrada") {
      estoque_depois = estoque_antes + quantidade;
    } else if (tipo === "saida") {
      if (Number(atual.vencido) === 1 && estoque_antes > 0) {
        const desperdicio = await registrarDesperdicioPorVencimento(conn, {
          produtoRow: atual,
          estoqueId: Number(estoque_id),
          usuario,
        });

        await conn.commit();

        return {
          bloqueado_vencido: true,
          message:
            "Produto vencido e improprio para consumo. O saldo vencido foi registrado como desperdicio.",
          desperdicio,
        };
      }

      estoque_depois = estoque_antes - quantidade;
      if (estoque_depois < 0) {
        throw Object.assign(new Error("Saldo insuficiente neste estoque."), {
          status: 400,
        });
      }
    } else {
      throw Object.assign(new Error("Tipo invalido"), { status: 400 });
    }

    await conn.query(
      "UPDATE estoque_produtos SET estoque_atual = ? WHERE produto_id = ? AND estoque_id = ?",
      [estoque_depois, produto.id, estoque_id],
    );

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
        atual.nome,
        observacao || null,
      ],
    );

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
      produto_nome: atual.nome,
      observacao: observacao || null,
      alerta_criado,
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

    const [origemRows] = await conn.query(
      `SELECT
        p.id,
        p.nome,
        ep.estoque_atual,
        ep.estoque_minimo,
        e.nome AS estoque_nome
       FROM produtos p
       INNER JOIN estoque_produtos ep ON ep.produto_id = p.id
       INNER JOIN estoques e ON e.id = ep.estoque_id
       WHERE p.id = ? AND ep.estoque_id = ?
       LIMIT 1
       FOR UPDATE`,
      [produto.id, estoque_origem_id],
    );

    if (!origemRows.length) {
      throw Object.assign(new Error("Produto nao vinculado ao estoque de origem"), {
        status: 404,
      });
    }

    const origem = origemRows[0];
    const origemAntes = Number(origem.estoque_atual);
    const origemDepois = origemAntes - quantidade;

    if (origemDepois < 0) {
      throw Object.assign(new Error("Saldo insuficiente neste estoque."), {
        status: 400,
      });
    }

    let [destinoProdutoRows] = await conn.query(
      `SELECT estoque_atual, estoque_minimo
       FROM estoque_produtos
       WHERE produto_id = ? AND estoque_id = ?
       LIMIT 1
       FOR UPDATE`,
      [produto.id, estoque_destino_id],
    );

    if (!destinoProdutoRows.length) {
      await conn.query(
        `INSERT INTO estoque_produtos
          (estoque_id, produto_id, estoque_atual, estoque_minimo, criado_em)
         VALUES (?, ?, 0, 0, NOW())`,
        [estoque_destino_id, produto.id],
      );

      destinoProdutoRows = [{ estoque_atual: 0, estoque_minimo: 0 }];
    }

    const destinoProduto = destinoProdutoRows[0];
    const destinoAntes = Number(destinoProduto.estoque_atual);
    const destinoDepois = destinoAntes + quantidade;
    const destinoNome = destinoRows[0].nome;

    await conn.query(
      "UPDATE estoque_produtos SET estoque_atual = ? WHERE produto_id = ? AND estoque_id = ?",
      [origemDepois, produto.id, estoque_origem_id],
    );

    await conn.query(
      "UPDATE estoque_produtos SET estoque_atual = ? WHERE produto_id = ? AND estoque_id = ?",
      [destinoDepois, produto.id, estoque_destino_id],
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
        origemDepois,
        usuario.nome,
        origem.nome,
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
        destinoDepois,
        usuario.nome,
        origem.nome,
        notaDestino,
      ],
    );

    await atualizarAlertasEstoque(
      conn,
      produto.id,
      estoque_origem_id,
      origemDepois,
      origem.estoque_minimo,
    );

    await atualizarAlertasEstoque(
      conn,
      produto.id,
      estoque_destino_id,
      destinoDepois,
      destinoProduto.estoque_minimo,
    );

    await conn.commit();

    return {
      saida_id: saida.insertId,
      entrada_id: entrada.insertId,
      produto_id: produto.id,
      produto_nome: origem.nome,
      estoque_origem_id,
      estoque_origem_nome: origem.estoque_nome,
      estoque_destino_id,
      estoque_destino_nome: destinoNome,
      quantidade,
      usuario_id: usuario.id,
      usuario_nome: usuario.nome,
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
      e.nome AS estoque_nome
    FROM movimentacoes m
    LEFT JOIN produtos p ON p.id = m.produto_id
    LEFT JOIN estoques e ON e.id = m.estoque_id
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
