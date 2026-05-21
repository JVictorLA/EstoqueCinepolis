const { pool } = require("../database/connection");
const estoqueService = require("./estoqueService");

const BASE_INVENTORY_SELECT = `
  SELECT
    p.id AS produto_id,
    p.codigo_barras,
    p.nome AS produto_nome,
    p.categoria_id,
    c.nome AS categoria_nome,
    COALESCE(c.exige_validade, 0) AS exige_validade,
    p.unidade,
    p.preco_venda,
    ep.estoque_id,
    e.nome AS estoque_nome,
    COALESCE(lotes.data_validade, ep.data_validade) AS data_validade,
    COALESCE(lotes.estoque_atual, ep.estoque_atual, 0) AS estoque_atual,
    COALESCE(ep.estoque_minimo, 0) AS estoque_minimo,
    p.ativo
  FROM produtos p
  LEFT JOIN categorias c ON c.id = p.categoria_id
  INNER JOIN estoque_produtos ep ON ep.produto_id = p.id
  INNER JOIN estoques e ON e.id = ep.estoque_id
  LEFT JOIN (
    SELECT estoque_produto_id,
      COALESCE(SUM(quantidade), 0) AS estoque_atual,
      MIN(CASE WHEN quantidade > 0 THEN data_validade ELSE NULL END) AS data_validade
    FROM produto_lotes
    GROUP BY estoque_produto_id
  ) lotes ON lotes.estoque_produto_id = ep.id
`;

const HIDE_EXPIRED_EMPTY_ITEMS = `
  AND NOT (
    COALESCE(lotes.estoque_atual, ep.estoque_atual, 0) <= 0
    AND COALESCE(lotes.data_validade, ep.data_validade) IS NOT NULL
    AND COALESCE(lotes.data_validade, ep.data_validade) < CURDATE()
  )
`;

function isAllStocks(estoqueId) {
  return !estoqueId || estoqueId === "all" || estoqueId === "null";
}

function getInventoryStatus(row) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (row.data_validade) {
    const expiration = new Date(`${String(row.data_validade).slice(0, 10)}T00:00:00`);
    if (!Number.isNaN(expiration.getTime())) {
      if (expiration < today) return "vencido";
      const msUntilExpiration = expiration.getTime() - today.getTime();
      const daysUntilExpiration = Math.ceil(msUntilExpiration / 86400000);
      if (daysUntilExpiration <= 30) return "proximo_vencimento";
    }
  }

  if (Number(row.estoque_atual) <= 0) return "sem_estoque";
  if (Number(row.estoque_minimo) > 0 && Number(row.estoque_atual) <= Number(row.estoque_minimo)) {
    return "estoque_baixo";
  }
  return "ok";
}

function mapInventoryRow(row) {
  return {
    produto_id: row.produto_id,
    codigo_barras: row.codigo_barras,
    produto_nome: row.produto_nome,
    categoria_id: row.categoria_id,
    categoria_nome: row.categoria_nome,
    exige_validade: row.exige_validade,
    unidade: row.unidade,
    preco_venda: row.preco_venda,
    estoque_id: row.estoque_id,
    estoque_nome: row.estoque_nome,
    data_validade: row.data_validade,
    estoque_atual: Number(row.estoque_atual),
    estoque_minimo: Number(row.estoque_minimo),
    ativo: row.ativo,
    status: getInventoryStatus(row),
    estoques: row.estoques || [],
  };
}

async function getEstoqueAtual(estoqueId = "all") {
  if (!isAllStocks(estoqueId)) {
    const id = Number(estoqueId);
    if (!id) {
      throw Object.assign(new Error("Estoque invalido"), { status: 400 });
    }

    const estoque = await estoqueService.findById(id);
    if (!estoque) {
      throw Object.assign(new Error("Estoque nao encontrado"), { status: 404 });
    }

    const [rows] = await pool.query(
      `${BASE_INVENTORY_SELECT}
       WHERE ep.estoque_id = ? AND p.ativo = 1
       ${HIDE_EXPIRED_EMPTY_ITEMS}
       ORDER BY p.nome ASC`,
      [id],
    );

    return rows.map(mapInventoryRow);
  }

  const [rows] = await pool.query(
    `${BASE_INVENTORY_SELECT}
     WHERE p.ativo = 1
     ${HIDE_EXPIRED_EMPTY_ITEMS}
     ORDER BY p.nome ASC, e.nome ASC`,
  );

  const grouped = new Map();
  rows.forEach((row) => {
    const current = grouped.get(row.produto_id);
    if (!current) {
      grouped.set(row.produto_id, {
        ...row,
        estoque_id: null,
        estoque_nome: "Todos os estoques",
        estoque_atual: Number(row.estoque_atual),
        estoque_minimo: Number(row.estoque_minimo),
        data_validade: row.data_validade,
        estoques: [
          {
            estoque_id: row.estoque_id,
            estoque_nome: row.estoque_nome,
            estoque_atual: Number(row.estoque_atual),
          },
        ],
      });
      return;
    }

    current.estoque_atual = Number(current.estoque_atual) + Number(row.estoque_atual);
    current.estoque_minimo = Number(current.estoque_minimo) + Number(row.estoque_minimo);
    current.estoques.push({
      estoque_id: row.estoque_id,
      estoque_nome: row.estoque_nome,
      estoque_atual: Number(row.estoque_atual),
    });

    if (!current.data_validade || (row.data_validade && row.data_validade < current.data_validade)) {
      current.data_validade = row.data_validade;
    }
  });

  return Array.from(grouped.values()).map(mapInventoryRow);
}

module.exports = {
  getEstoqueAtual,
  isAllStocks,
};
