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
  LEFT JOIN estoque_produtos ep ON ep.produto_id = p.id
    AND EXISTS (
      SELECT 1
      FROM estoques active_stock
      WHERE active_stock.id = ep.estoque_id
        AND COALESCE(active_stock.arquivado, 0) = 0
    )
  LEFT JOIN estoques e ON e.id = ep.estoque_id
  LEFT JOIN (
    SELECT estoque_produto_id,
      COALESCE(SUM(quantidade), 0) AS estoque_atual,
      MIN(CASE WHEN quantidade > 0 THEN data_validade ELSE NULL END) AS data_validade
    FROM produto_lotes
    GROUP BY estoque_produto_id
  ) lotes ON lotes.estoque_produto_id = ep.id
`;

function isAllStocks(estoqueId) {
  return !estoqueId || estoqueId === "all" || estoqueId === "null";
}

function isExpired(row) {
  if (!row.data_validade) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiration = new Date(`${String(row.data_validade).slice(0, 10)}T00:00:00`);
  return !Number.isNaN(expiration.getTime()) && expiration < today;
}

function getInventoryStock(row) {
  if (isExpired(row)) return 0;
  return Number(row.estoque_atual);
}

function getInventoryStatus(row) {
  if (isExpired(row)) return "vencido";
  if (getInventoryStock(row) <= 0) return "sem_estoque";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (row.data_validade) {
    const expiration = new Date(`${String(row.data_validade).slice(0, 10)}T00:00:00`);
    if (!Number.isNaN(expiration.getTime())) {
      const msUntilExpiration = expiration.getTime() - today.getTime();
      const daysUntilExpiration = Math.ceil(msUntilExpiration / 86400000);
      if (daysUntilExpiration <= 7) return "proximo_vencimento";
      if (daysUntilExpiration <= 15) return "validade_15";
      if (daysUntilExpiration <= 30) return "validade_30";
    }
  }

  if (Number(row.estoque_minimo) > 0 && getInventoryStock(row) <= Number(row.estoque_minimo)) {
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
    estoque_atual: getInventoryStock(row),
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
      throw Object.assign(new Error("Estoque inválido"), { status: 400 });
    }

    const estoque = await estoqueService.findById(id);
    if (!estoque) {
      throw Object.assign(new Error("Estoque não encontrado"), { status: 404 });
    }
    if (estoque.arquivado) {
      throw Object.assign(new Error("Estoque arquivado"), { status: 400 });
    }

    const [rows] = await pool.query(
      `SELECT
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
       LEFT JOIN estoque_produtos ep ON ep.produto_id = p.id AND ep.estoque_id = ?
       LEFT JOIN estoques e ON e.id = ?
       LEFT JOIN (
         SELECT estoque_produto_id,
           COALESCE(SUM(quantidade), 0) AS estoque_atual,
           MIN(CASE WHEN quantidade > 0 THEN data_validade ELSE NULL END) AS data_validade
         FROM produto_lotes
         GROUP BY estoque_produto_id
       ) lotes ON lotes.estoque_produto_id = ep.id
       WHERE p.ativo = 1
       ORDER BY p.nome ASC`,
      [id, id],
    );

    return rows.map((row) =>
      mapInventoryRow({
        ...row,
        estoque_id: row.estoque_id ?? id,
        estoque_nome: row.estoque_nome ?? estoque.nome,
      }),
    );
  }

  const [rows] = await pool.query(
    `${BASE_INVENTORY_SELECT}
     WHERE p.ativo = 1
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
        estoque_atual: getInventoryStock(row),
        estoque_minimo: Number(row.estoque_minimo),
        data_validade: row.data_validade,
        estoques: row.estoque_id
          ? [
              {
                estoque_id: row.estoque_id,
                estoque_nome: row.estoque_nome,
                estoque_atual: getInventoryStock(row),
              },
            ]
          : [],
      });
      return;
    }

    current.estoque_atual = Number(current.estoque_atual) + getInventoryStock(row);
    current.estoque_minimo = Number(current.estoque_minimo) + Number(row.estoque_minimo);
    if (row.estoque_id) {
      current.estoques.push({
        estoque_id: row.estoque_id,
        estoque_nome: row.estoque_nome,
        estoque_atual: getInventoryStock(row),
      });
    }

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
