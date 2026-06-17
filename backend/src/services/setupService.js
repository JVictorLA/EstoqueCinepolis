const bcrypt = require("bcrypt");
const { pool } = require("../database/connection");
const configuracaoService = require("./configuracaoService");

async function isSetupConcluido(conn = pool) {
  const value = await configuracaoService.getConfig("setup_concluido", conn);
  return ["true", "1", "sim", "yes"].includes(String(value ?? "").toLowerCase());
}

async function getStatus() {
  const [rows] = await pool.query(
    "SELECT id FROM usuarios WHERE tipo IN ('master', 'admin') LIMIT 1",
  );
  const hasAdminOrMaster = rows.length > 0;
  const setupConcluido = await isSetupConcluido();

  return {
    precisaSetup: !hasAdminOrMaster || !setupConcluido,
    setupConcluido,
  };
}

function uniqueStockNames(estoques) {
  const names = (Array.isArray(estoques) ? estoques : [])
    .map((nome) => String(nome || "").trim())
    .filter(Boolean);
  return Array.from(new Set(names.map((name) => name.toLowerCase()))).map((lower) =>
    names.find((name) => name.toLowerCase() === lower),
  );
}

function validatePayload(payload) {
  const empresa = payload?.empresa || {};
  const sistema = payload?.sistema || {};
  const master = payload?.master || {};
  const estoques = uniqueStockNames(payload?.estoques);

  if (!String(empresa.nome_empresa || "").trim()) {
    return { error: "nome_empresa é obrigatório" };
  }
  if (!estoques.length) {
    return { error: "Informe pelo menos um estoque inicial" };
  }
  if (!String(master.nome || "").trim() || !String(master.matricula || "").trim() || !master.senha) {
    return { error: "nome, matrícula e senha do master são obrigatórios" };
  }
  if (String(master.senha).length < 6) {
    return { error: "A senha deve ter pelo menos 6 caracteres" };
  }
  if (sistema.tema_padrao && !["light", "dark"].includes(sistema.tema_padrao)) {
    return { error: "tema_padrao deve ser light ou dark" };
  }
  if (sistema.dias_alerta_validade !== undefined && Number(sistema.dias_alerta_validade) < 1) {
    return { error: "dias_alerta_validade deve ser maior ou igual a 1" };
  }

  return { empresa, sistema, master, estoques };
}

function buildConfigItems(empresa, sistema, estoques) {
  const systemDefaults = {
    nome_sistema: "Zytrex Inventory",
    tema_padrao: "light",
    dias_alerta_validade: 7,
    permitir_estoque_negativo: false,
    bloquear_saida_produto_vencido: true,
    registrar_vencido_ao_tentar_retirar: true,
    permitir_ignorar_fefo: true,
    exigir_justificativa_fefo: true,
    ...sistema,
  };

  const empresaKeys = [
    "nome_empresa",
    "unidade_empresa",
    "cnpj_empresa",
    "cidade_empresa",
    "uf_empresa",
    "endereco_empresa",
    "telefone_empresa",
    "email_empresa",
    "logo_url",
  ];

  const items = empresaKeys.map((chave) => ({
    chave,
    valor: empresa[chave] ?? "",
    categoria: "empresa",
    nivelAcesso: "master",
  }));

  Object.entries(systemDefaults).forEach(([chave, valor]) => {
    items.push({
      chave,
      valor,
      categoria: "sistema",
      nivelAcesso: ["tema_padrao", "nome_sistema"].includes(chave) ? "admin" : "master",
    });
  });

  items.push(
    {
      chave: "criar_estoques_iniciais_setup",
      valor: true,
      categoria: "setup",
      nivelAcesso: "master",
    },
    {
      chave: "nomes_estoques_iniciais",
      valor: estoques,
      categoria: "setup",
      nivelAcesso: "master",
    },
    {
      chave: "setup_concluido",
      valor: true,
      categoria: "setup",
      nivelAcesso: "master",
    },
    {
      chave: "setup_data_conclusao",
      valor: new Date().toISOString(),
      categoria: "setup",
      nivelAcesso: "master",
    },
  );

  return items;
}

async function executarSetupInicial(payload) {
  const validated = validatePayload(payload);
  if (validated.error) {
    const error = new Error(validated.error);
    error.status = 400;
    throw error;
  }

  const { empresa, sistema, master, estoques } = validated;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [adminRows] = await conn.query(
      "SELECT id FROM usuarios WHERE tipo IN ('master', 'admin') LIMIT 1 FOR UPDATE",
    );
    const setupConcluido = await isSetupConcluido(conn);

    if (adminRows.length && setupConcluido) {
      const error = new Error("Setup inicial ja foi concluido");
      error.status = 409;
      throw error;
    }

    const [matriculaRows] = await conn.query(
      "SELECT id FROM usuarios WHERE matricula = ? LIMIT 1",
      [String(master.matricula).trim()],
    );
    if (matriculaRows.length) {
      const error = new Error("Matrícula já cadastrada");
      error.status = 409;
      throw error;
    }

    const senhaHash = await bcrypt.hash(master.senha, 10);
    const [userResult] = await conn.query(
      `INSERT INTO usuarios
        (
          matricula,
          nome,
          email,
          senha_hash,
          tipo,
          ativo,
          criado_em,
          atualizado_em,
          senha_atualizada_em,
          precisa_trocar_senha
        )
       VALUES (?, ?, ?, ?, 'master', 1, NOW(), NOW(), NOW(), 0)`,
      [
        String(master.matricula).trim(),
        String(master.nome).trim(),
        master.email ? String(master.email).trim() : null,
        senhaHash,
      ],
    );

    for (const nome of estoques) {
      const [existing] = await conn.query(
        "SELECT id FROM estoques WHERE LOWER(nome) = LOWER(?) LIMIT 1",
        [nome],
      );
      if (!existing.length) {
        await conn.query("INSERT INTO estoques (nome, ativo, criado_em) VALUES (?, 1, NOW())", [
          nome,
        ]);
      }
    }

    await configuracaoService.setManyConfigs(
      buildConfigItems(empresa, sistema, estoques),
      userResult.insertId,
      conn,
    );

    await conn.commit();

    return {
      master: {
        id: userResult.insertId,
        nome: String(master.nome).trim(),
        matricula: String(master.matricula).trim(),
        email: master.email ? String(master.email).trim() : null,
        tipo: "master",
        ativo: true,
      },
      estoques,
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

module.exports = {
  getStatus,
  executarSetupInicial,
};
