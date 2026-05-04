const { pool } = require("../database/connection");

/**
 * Tabela `movimentacoes`:
 *   id, produto_id, usuario_id, tipo, quantidade,
 *   estoque_antes, estoque_depois, usuario_nome, produto_nome,
 *   observacao, criado_em
 *
 * Tabela `alertas_estoque`:
 *   id, produto_id, tipo, resolvido, criado_em
 */

/**
 * Executa entrada/saída em transação:
 *  - bloqueia a linha do produto (FOR UPDATE)
 *  - calcula estoque_antes / estoque_depois
 *  - impede estoque negativo
 *  - atualiza produto
 *  - insere em movimentacoes
 *  - insere alerta de baixo_estoque se necessário
 */
async function registrarMovimentacao({
  produto,         // objeto produto (precisa ter id, nome, estoque_atual, estoque_minimo)
  usuario,         // objeto usuario { id, nome }
  tipo,            // "entrada" | "saida"
  quantidade,
  observacao,
}) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      "SELECT id, nome, estoque_atual, estoque_minimo FROM produtos WHERE id = ? FOR UPDATE",
      [produto.id]
    );
    if (!rows.length) {
      throw Object.assign(new Error("Produto não encontrado"), { status: 404 });
    }
    const atual = rows[0];
    const estoque_antes = Number(atual.estoque_atual);

    let estoque_depois;
    if (tipo === "entrada") {
      estoque_depois = estoque_antes + quantidade;
    } else if (tipo === "saida") {
      estoque_depois = estoque_antes - quantidade;
      if (estoque_depois < 0) {
        throw Object.assign(
          new Error(
            `Estoque insuficiente. Disponível: ${estoque_antes}, solicitado: ${quantidade}`
          ),
          { status: 400 }
        );
      }
    } else {
      throw Object.assign(new Error("Tipo inválido"), { status: 400 });
    }

    await conn.query(
      "UPDATE produtos SET estoque_atual = ?, atualizado_em = NOW() WHERE id = ?",
      [estoque_depois, produto.id]
    );

    const [insMov] = await conn.query(
      `INSERT INTO movimentacoes
        (produto_id, usuario_id, tipo, quantidade,
         estoque_antes, estoque_depois,
         usuario_nome, produto_nome, observacao, criado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        produto.id,
        usuario.id,
        tipo,
        quantidade,
        estoque_antes,
        estoque_depois,
        usuario.nome,
        atual.nome,
        observacao || null,
      ]
    );

    let alerta_criado = false;
    if (
      Number(atual.estoque_minimo) > 0 &&
      estoque_depois <= Number(atual.estoque_minimo)
    ) {
      // Não duplicar alerta aberto para o mesmo produto
      const [openAlerts] = await conn.query(
        "SELECT id FROM alertas_estoque WHERE produto_id = ? AND resolvido = 0 LIMIT 1",
        [produto.id]
      );
      if (!openAlerts.length) {
        await conn.query(
          `INSERT INTO alertas_estoque (produto_id, tipo, resolvido, criado_em)
           VALUES (?, 'baixo_estoque', 0, NOW())`,
          [produto.id]
        );
        alerta_criado = true;
      }
    }

    await conn.commit();

    return {
      id: insMov.insertId,
      produto_id: produto.id,
      usuario_id: usuario.id,
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

/**
 * Lista movimentações com filtros opcionais:
 *   data_inicial, data_final, tipo, produto_id, codigo_barras, usuario_id
 */
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

  const sql = `
    SELECT
      m.id,
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
      p.codigo_barras
    FROM movimentacoes m
    LEFT JOIN produtos p ON p.id = m.produto_id
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY m.criado_em DESC
    LIMIT 1000
  `;

  const [rows] = await pool.query(sql, params);
  return rows;
}

module.exports = { registrarMovimentacao, listar };
