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

async function columnExists(tableName, columnName) {
  const [rows] = await pool.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND column_name = ?
     LIMIT 1`,
    [tableName, columnName],
  );
  return rows.length > 0;
}

async function ensureColumn(tableName, columnName, sql) {
  if (await columnExists(tableName, columnName)) return;
  await pool.query(sql);
}

async function ensureDatabaseSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS motivos_desperdicio (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nome VARCHAR(100) NOT NULL,
      ativo TINYINT(1) DEFAULT 1,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const [motivos] = await pool.query("SELECT COUNT(*) AS total FROM motivos_desperdicio");
  if (Number(motivos[0]?.total || 0) === 0) {
    await pool.query(`
      INSERT INTO motivos_desperdicio (nome) VALUES
      ('Produto vencido'),
      ('Produto danificado'),
      ('Produto aberto por engano'),
      ('Produto derramado'),
      ('Erro operacional'),
      ('Quebra de embalagem'),
      ('Contaminação'),
      ('Perda no preparo'),
      ('Sobra descartada'),
      ('Outro')
    `);
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS desperdicios (
      id INT AUTO_INCREMENT PRIMARY KEY,
      estoque_id INT NOT NULL,
      produto_id INT NOT NULL,
      usuario_id INT NOT NULL,
      motivo_id INT NOT NULL,
      quantidade DECIMAL(10,2) NOT NULL,
      estoque_antes DECIMAL(10,2) NULL,
      estoque_depois DECIMAL(10,2) NULL,
      valor_unitario DECIMAL(10,2) NULL,
      valor_total DECIMAL(10,2) NULL,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_desperdicio_estoque
        FOREIGN KEY (estoque_id) REFERENCES estoques(id),
      CONSTRAINT fk_desperdicio_produto
        FOREIGN KEY (produto_id) REFERENCES produtos(id),
      CONSTRAINT fk_desperdicio_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
      CONSTRAINT fk_desperdicio_motivo
        FOREIGN KEY (motivo_id) REFERENCES motivos_desperdicio(id)
    )
  `);

  await ensureColumn(
    "desperdicios",
    "estoque_id",
    "ALTER TABLE desperdicios ADD COLUMN estoque_id INT NULL AFTER id",
  );
  await ensureColumn(
    "desperdicios",
    "produto_id",
    "ALTER TABLE desperdicios ADD COLUMN produto_id INT NULL AFTER estoque_id",
  );
  await ensureColumn(
    "desperdicios",
    "usuario_id",
    "ALTER TABLE desperdicios ADD COLUMN usuario_id INT NULL AFTER produto_id",
  );
  await ensureColumn(
    "desperdicios",
    "motivo_id",
    "ALTER TABLE desperdicios ADD COLUMN motivo_id INT NULL AFTER usuario_id",
  );
  await ensureColumn(
    "desperdicios",
    "quantidade",
    "ALTER TABLE desperdicios ADD COLUMN quantidade DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER motivo_id",
  );
  await ensureColumn(
    "desperdicios",
    "estoque_antes",
    "ALTER TABLE desperdicios ADD COLUMN estoque_antes DECIMAL(10,2) NULL AFTER quantidade",
  );
  await ensureColumn(
    "desperdicios",
    "estoque_depois",
    "ALTER TABLE desperdicios ADD COLUMN estoque_depois DECIMAL(10,2) NULL AFTER estoque_antes",
  );
  await ensureColumn(
    "desperdicios",
    "valor_unitario",
    "ALTER TABLE desperdicios ADD COLUMN valor_unitario DECIMAL(10,2) NULL AFTER estoque_depois",
  );
  await ensureColumn(
    "desperdicios",
    "valor_total",
    "ALTER TABLE desperdicios ADD COLUMN valor_total DECIMAL(10,2) NULL AFTER valor_unitario",
  );
  await ensureColumn(
    "desperdicios",
    "criado_em",
    "ALTER TABLE desperdicios ADD COLUMN criado_em DATETIME DEFAULT CURRENT_TIMESTAMP AFTER valor_total",
  );

  const [tipoColumns] = await pool.query(
    `SELECT COLUMN_TYPE
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'movimentacoes'
       AND column_name = 'tipo'
     LIMIT 1`,
  );

  const columnType = String(tipoColumns[0]?.COLUMN_TYPE || tipoColumns[0]?.column_type || "");
  if (/^enum/i.test(columnType) && !columnType.includes("'desperdicio'")) {
    await pool.query(
      "ALTER TABLE movimentacoes MODIFY tipo ENUM('entrada','saida','desperdicio') NOT NULL",
    );
  }

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

  await ensureIndex(
    "desperdicios",
    "idx_desperdicios_estoque_data",
    "CREATE INDEX idx_desperdicios_estoque_data ON desperdicios(estoque_id, criado_em)",
  );

  await ensureIndex(
    "desperdicios",
    "idx_desperdicios_produto",
    "CREATE INDEX idx_desperdicios_produto ON desperdicios(produto_id)",
  );

  await ensureIndex(
    "desperdicios",
    "idx_desperdicios_motivo",
    "CREATE INDEX idx_desperdicios_motivo ON desperdicios(motivo_id)",
  );
}

module.exports = { ensureDatabaseSchema };
