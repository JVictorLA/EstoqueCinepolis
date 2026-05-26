const { pool } = require("../database/connection");

const TABLE = "configuracoes_sistema";

let cachedColumns = null;

async function getColumns(conn = pool, table = TABLE) {
  if (table === TABLE && cachedColumns) return cachedColumns;

  const [rows] = await conn.query(`SHOW COLUMNS FROM ${table}`);
  const columns = new Set(rows.map((row) => row.Field));

  if (table === TABLE) cachedColumns = columns;
  return columns;
}

function pickColumn(columns, candidates) {
  return candidates.find((column) => columns.has(column)) || null;
}

async function getConfigColumns(conn = pool) {
  const columns = await getColumns(conn);
  const chave = pickColumn(columns, ["chave", "key", "nome", "config_key"]);
  const valor = pickColumn(columns, ["valor", "value", "config_value"]);

  if (!chave || !valor) {
    throw new Error("Tabela configuracoes_sistema precisa ter colunas de chave e valor");
  }

  return {
    columns,
    chave,
    valor,
    descricao: pickColumn(columns, ["descricao", "description"]),
    tipo: pickColumn(columns, ["tipo", "type"]),
    categoria: pickColumn(columns, ["categoria", "grupo", "category"]),
    nivelAcesso: pickColumn(columns, ["nivel_acesso", "access_level"]),
    atualizadoPor: pickColumn(columns, ["atualizado_por", "updated_by"]),
    criadoEm: pickColumn(columns, ["criado_em", "created_at"]),
    atualizadoEm: pickColumn(columns, ["atualizado_em", "updated_at"]),
  };
}

function serializeValue(value) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null || value === undefined) return "";
  return JSON.stringify(value);
}

function inferType(value) {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (Array.isArray(value) || (value && typeof value === "object")) return "json";
  return "string";
}

async function getConfig(chave, conn = pool) {
  const config = await getConfigColumns(conn);
  const [rows] = await conn.query(
    `SELECT ${config.valor} AS valor FROM ${TABLE} WHERE ${config.chave} = ? LIMIT 1`,
    [chave],
  );
  return rows[0]?.valor ?? null;
}

async function setConfig(chave, valor, atualizadoPor = null, options = {}, conn = pool) {
  const config = await getConfigColumns(conn);
  const serialized = serializeValue(valor);
  const [rows] = await conn.query(
    `SELECT ${config.chave} FROM ${TABLE} WHERE ${config.chave} = ? LIMIT 1`,
    [chave],
  );

  if (rows.length) {
    const fields = [`${config.valor} = ?`];
    const values = [serialized];

    if (config.tipo) {
      fields.push(`${config.tipo} = ?`);
      values.push(options.tipo || inferType(valor));
    }
    if (config.categoria && options.categoria) {
      fields.push(`${config.categoria} = ?`);
      values.push(options.categoria);
    }
    if (config.nivelAcesso && options.nivelAcesso) {
      fields.push(`${config.nivelAcesso} = ?`);
      values.push(options.nivelAcesso);
    }
    if (config.atualizadoPor) {
      fields.push(`${config.atualizadoPor} = ?`);
      values.push(atualizadoPor);
    }
    if (config.atualizadoEm) fields.push(`${config.atualizadoEm} = NOW()`);

    values.push(chave);
    await conn.query(`UPDATE ${TABLE} SET ${fields.join(", ")} WHERE ${config.chave} = ?`, values);
    return;
  }

  const columns = [config.chave, config.valor];
  const placeholders = ["?", "?"];
  const values = [chave, serialized];

  if (config.descricao && options.descricao) {
    columns.push(config.descricao);
    placeholders.push("?");
    values.push(options.descricao);
  }
  if (config.tipo) {
    columns.push(config.tipo);
    placeholders.push("?");
    values.push(options.tipo || inferType(valor));
  }
  if (config.categoria) {
    columns.push(config.categoria);
    placeholders.push("?");
    values.push(options.categoria || "sistema");
  }
  if (config.nivelAcesso) {
    columns.push(config.nivelAcesso);
    placeholders.push("?");
    values.push(options.nivelAcesso || "admin");
  }
  if (config.atualizadoPor) {
    columns.push(config.atualizadoPor);
    placeholders.push("?");
    values.push(atualizadoPor);
  }
  if (config.criadoEm) {
    columns.push(config.criadoEm);
    placeholders.push("NOW()");
  }
  if (config.atualizadoEm) {
    columns.push(config.atualizadoEm);
    placeholders.push("NOW()");
  }

  await conn.query(
    `INSERT INTO ${TABLE} (${columns.join(", ")}) VALUES (${placeholders.join(", ")})`,
    values,
  );
}

async function setManyConfigs(configs, atualizadoPor = null, conn = pool) {
  for (const item of configs) {
    await setConfig(item.chave, item.valor, atualizadoPor, item, conn);
  }
}

async function getPublicConfigs(conn = pool) {
  const config = await getConfigColumns(conn);
  const where = config.nivelAcesso
    ? `WHERE ${config.nivelAcesso} IN ('publico', 'public', 'admin') OR ${config.nivelAcesso} IS NULL`
    : "";
  const [rows] = await conn.query(`SELECT * FROM ${TABLE} ${where} ORDER BY ${config.chave} ASC`);
  return rows;
}

async function getConfigsByNivelAcesso(userTipo, conn = pool) {
  const config = await getConfigColumns(conn);
  const values = userTipo === "master" ? ["publico", "public", "admin", "master"] : ["publico", "public", "admin"];
  const where = config.nivelAcesso
    ? `WHERE ${config.nivelAcesso} IN (${values.map(() => "?").join(", ")}) OR ${config.nivelAcesso} IS NULL`
    : "";
  const [rows] = await conn.query(`SELECT * FROM ${TABLE} ${where} ORDER BY ${config.chave} ASC`, values);
  return rows;
}

module.exports = {
  getConfig,
  setConfig,
  setManyConfigs,
  getPublicConfigs,
  getConfigsByNivelAcesso,
};
