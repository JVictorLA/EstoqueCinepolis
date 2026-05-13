const { pool } = require("./connection");

async function indexExists(tableName, indexName) {
  const [rows] = await pool.query(
    `SELECT 1
     FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND index_name = ?
     LIMIT 1`,
    [tableName, indexName],
  );
  return rows.length > 0;
}

async function ensureIndex(tableName, indexName, sql) {
  if (await indexExists(tableName, indexName)) return;
  await pool.query(sql);
}

async function ensureDatabaseSchema() {
  await ensureIndex(
    "estoque_produtos",
    "uq_estoque_produtos_estoque_produto",
    `ALTER TABLE estoque_produtos
     ADD CONSTRAINT uq_estoque_produtos_estoque_produto
     UNIQUE (estoque_id, produto_id)`,
  );

  await ensureIndex(
    "produtos",
    "idx_produtos_codigo_barras",
    "CREATE INDEX idx_produtos_codigo_barras ON produtos(codigo_barras)",
  );

  await ensureIndex(
    "estoque_produtos",
    "idx_estoque_produtos_estoque",
    "CREATE INDEX idx_estoque_produtos_estoque ON estoque_produtos(estoque_id)",
  );

  await ensureIndex(
    "movimentacoes",
    "idx_movimentacoes_estoque",
    "CREATE INDEX idx_movimentacoes_estoque ON movimentacoes(estoque_id)",
  );

  await ensureIndex(
    "alertas_estoque",
    "idx_alertas_estoque_estoque_produto",
    "CREATE INDEX idx_alertas_estoque_estoque_produto ON alertas_estoque(estoque_id, produto_id, resolvido)",
  );
}

module.exports = { ensureDatabaseSchema };
