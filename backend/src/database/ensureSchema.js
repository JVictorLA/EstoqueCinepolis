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
    "usuarios",
    "atualizado_em",
    "ALTER TABLE usuarios ADD COLUMN atualizado_em DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER criado_em",
  );

  await ensureColumn(
    "usuarios",
    "senha_atualizada_em",
    "ALTER TABLE usuarios ADD COLUMN senha_atualizada_em DATETIME NULL AFTER atualizado_em",
  );

  await ensureColumn(
    "usuarios",
    "theme_preference",
    "ALTER TABLE usuarios ADD COLUMN theme_preference VARCHAR(10) NOT NULL DEFAULT 'light' AFTER senha_atualizada_em",
  );

  await ensureColumn(
    "usuarios",
    "login_tentativas_falhas",
    "ALTER TABLE usuarios ADD COLUMN login_tentativas_falhas INT NOT NULL DEFAULT 0 AFTER theme_preference",
  );

  await ensureColumn(
    "usuarios",
    "login_bloqueado_ate",
    "ALTER TABLE usuarios ADD COLUMN login_bloqueado_ate DATETIME NULL AFTER login_tentativas_falhas",
  );

  await ensureColumn(
    "usuarios",
    "login_bloqueio_nivel",
    "ALTER TABLE usuarios ADD COLUMN login_bloqueio_nivel INT NOT NULL DEFAULT 0 AFTER login_bloqueado_ate",
  );

  await ensureColumn(
    "estoques",
    "tipo",
    "ALTER TABLE estoques ADD COLUMN tipo VARCHAR(20) NOT NULL DEFAULT 'permanente' AFTER ativo",
  );

  await ensureColumn(
    "estoques",
    "arquivado",
    "ALTER TABLE estoques ADD COLUMN arquivado TINYINT(1) NOT NULL DEFAULT 0 AFTER tipo",
  );

  await ensureColumn(
    "estoques",
    "arquivado_em",
    "ALTER TABLE estoques ADD COLUMN arquivado_em DATETIME NULL AFTER arquivado",
  );

  await pool.query(`
    UPDATE estoques
    SET tipo = COALESCE(NULLIF(tipo, ''), 'permanente'),
        arquivado = COALESCE(arquivado, 0)
  `);

  await pool.query(`
    UPDATE usuarios
    SET atualizado_em = COALESCE(atualizado_em, criado_em, NOW()),
        senha_atualizada_em = COALESCE(senha_atualizada_em, criado_em, NOW())
    WHERE atualizado_em IS NULL OR senha_atualizada_em IS NULL
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
  if (
    /^enum/i.test(columnType) &&
    (!columnType.includes("'desperdicio'") || !columnType.includes("'ajuste'"))
  ) {
    await pool.query(
      "ALTER TABLE movimentacoes MODIFY tipo ENUM('entrada','saida','desperdicio','ajuste') NOT NULL",
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS kits_caixa (
      id INT AUTO_INCREMENT PRIMARY KEY,
      estoque_id INT NOT NULL,
      nome VARCHAR(150) NOT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'kit_incompleto',
      responsavel_atual_id INT NULL,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_kits_caixa_estoque
        FOREIGN KEY (estoque_id) REFERENCES estoques(id),
      CONSTRAINT fk_kits_caixa_responsavel
        FOREIGN KEY (responsavel_atual_id) REFERENCES usuarios(id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS kit_itens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      kit_id INT NOT NULL,
      produto_id INT NOT NULL,
      quantidade_padrao DECIMAL(10,2) NOT NULL,
      quantidade_atual DECIMAL(10,2) NOT NULL DEFAULT 0,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_kit_itens_kit
        FOREIGN KEY (kit_id) REFERENCES kits_caixa(id) ON DELETE CASCADE,
      CONSTRAINT fk_kit_itens_produto
        FOREIGN KEY (produto_id) REFERENCES produtos(id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS kit_movimentacoes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      kit_id INT NOT NULL,
      estoque_id INT NOT NULL,
      usuario_id INT NOT NULL,
      tipo VARCHAR(30) NOT NULL,
      observacao TEXT NULL,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_kit_mov_kit
        FOREIGN KEY (kit_id) REFERENCES kits_caixa(id),
      CONSTRAINT fk_kit_mov_estoque
        FOREIGN KEY (estoque_id) REFERENCES estoques(id),
      CONSTRAINT fk_kit_mov_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS kit_movimentacao_itens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      kit_movimentacao_id INT NOT NULL,
      produto_id INT NOT NULL,
      quantidade_anterior DECIMAL(10,2) NOT NULL,
      reposicao_operacao DECIMAL(10,2) NOT NULL DEFAULT 0,
      quantidade_movimentada DECIMAL(10,2) NOT NULL,
      quantidade_final DECIMAL(10,2) NOT NULL,
      CONSTRAINT fk_kit_mov_itens_mov
        FOREIGN KEY (kit_movimentacao_id) REFERENCES kit_movimentacoes(id) ON DELETE CASCADE,
      CONSTRAINT fk_kit_mov_itens_produto
        FOREIGN KEY (produto_id) REFERENCES produtos(id)
    )
  `);

  await ensureColumn(
    "kit_movimentacao_itens",
    "reposicao_operacao",
    "ALTER TABLE kit_movimentacao_itens ADD COLUMN reposicao_operacao DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER quantidade_anterior",
  );

  await ensureIndex(
    "kits_caixa",
    "idx_kits_caixa_estoque_status",
    "CREATE INDEX idx_kits_caixa_estoque_status ON kits_caixa(estoque_id, status)",
  );
  await ensureIndex(
    "kit_itens",
    "uq_kit_itens_kit_produto",
    "ALTER TABLE kit_itens ADD CONSTRAINT uq_kit_itens_kit_produto UNIQUE (kit_id, produto_id)",
  );
  await ensureIndex(
    "kit_movimentacoes",
    "idx_kit_movimentacoes_kit_data",
    "CREATE INDEX idx_kit_movimentacoes_kit_data ON kit_movimentacoes(kit_id, criado_em)",
  );
}

module.exports = { ensureDatabaseSchema };
