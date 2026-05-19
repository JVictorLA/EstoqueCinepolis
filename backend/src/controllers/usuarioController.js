const bcrypt = require("bcrypt");
const usuarioService = require("../services/usuarioService");
const { ok, created, fail } = require("../utils/response");
const { pool } = require("../database/connection");

async function buscarPorMatricula(req, res) {
  const { matricula } = req.params;

  const [rows] = await pool.query(
    `SELECT
      id,
      matricula,
      nome,
      tipo,
      precisa_trocar_senha
     FROM usuarios
     WHERE matricula = ?
     LIMIT 1`,
    [matricula],
  );

  if (rows.length === 0) {
    return fail(res, 404, "Usuario nao encontrado");
  }

  return ok(res, rows[0], "Usuario encontrado");
}

async function listar(req, res) {
  const rows = await usuarioService.listAll({
    includeMaster: req.user?.tipo === "master",
  });
  return ok(res, rows);
}

async function criar(req, res) {
  const { matricula, nome, email, senha, tipo, ativo } = req.body || {};

  if (!matricula || !nome || !senha || !tipo) {
    return fail(res, 400, "matricula, nome, senha e tipo sao obrigatorios");
  }

  if (!["admin", "operador"].includes(tipo)) {
    return fail(res, 400, "tipo deve ser 'admin' ou 'operador'");
  }

  if (await usuarioService.existsByMatricula(matricula)) {
    return fail(res, 409, "Matricula ja cadastrada");
  }

  const novo = await usuarioService.create({
    matricula: String(matricula).trim(),
    nome: String(nome).trim(),
    email: email ? String(email).trim() : null,
    senha,
    tipo,
    ativo: ativo === undefined ? true : !!ativo,
  });

  return created(res, novo, "Usuario criado");
}

async function atualizar(req, res) {
  const id = Number(req.params.id);
  if (!id) return fail(res, 400, "id invalido");

  const existing = await usuarioService.findById(id);
  if (!existing) return fail(res, 404, "Usuario nao encontrado");

  const { matricula, nome, email, senha, tipo, ativo } = req.body || {};

  if (tipo && !["admin", "operador"].includes(tipo)) {
    return fail(res, 400, "tipo deve ser 'admin' ou 'operador'");
  }

  if (existing.tipo === "master") {
    if (tipo && tipo !== existing.tipo) {
      return fail(res, 403, "Usuario master nao pode ter o tipo alterado");
    }
    if (ativo === false || ativo === 0) {
      return fail(res, 403, "Usuario master nao pode ser desativado");
    }
  }

  if (matricula && matricula !== existing.matricula) {
    if (await usuarioService.existsByMatricula(matricula)) {
      return fail(res, 409, "Matricula ja cadastrada");
    }
  }

  const atualizado = await usuarioService.update(id, {
    matricula,
    nome,
    email,
    senha,
    tipo: existing.tipo === "master" ? undefined : tipo,
    ativo,
  });

  return ok(res, atualizado, "Usuario atualizado");
}

async function alterarSenha(req, res) {
  const id = Number(req.params.id);
  const { senhaAtual, novaSenha } = req.body;

  if (!id) return fail(res, 400, "ID invalido");
  if (!senhaAtual || !novaSenha) {
    return fail(res, 400, "Informe senhaAtual e novaSenha");
  }

  const user = await usuarioService.findByIdWithPassword(id);
  if (!user) return fail(res, 404, "Usuario nao encontrado");

  const senhaValida = await bcrypt.compare(senhaAtual, user.senha_hash);
  if (!senhaValida) {
    return fail(res, 401, "Senha atual incorreta");
  }

  await usuarioService.update(id, { senha: novaSenha });
  return ok(res, null, "Senha atualizada com sucesso");
}

async function alterarStatus(req, res) {
  const id = Number(req.params.id);
  if (!id) return fail(res, 400, "id invalido");

  const { ativo } = req.body || {};
  if (ativo === undefined) return fail(res, 400, "Informe 'ativo' (true/false)");

  const existing = await usuarioService.findById(id);
  if (!existing) return fail(res, 404, "Usuario nao encontrado");
  if (existing.tipo === "master") {
    return fail(res, 403, "Usuario master nao pode ser desativado");
  }

  const atualizado = await usuarioService.setStatus(id, !!ativo);
  return ok(res, atualizado, "Status atualizado");
}

async function resetarSenha(req, res) {
  const id = Number(req.params.id);
  if (!id) return fail(res, 400, "ID invalido");

  const existing = await usuarioService.findById(id);
  if (!existing) return fail(res, 404, "Usuario nao encontrado");
  if (existing.tipo === "master") {
    return fail(res, 403, "Senha do master nao pode ser resetada pelo CRUD comum");
  }

  await usuarioService.resetPassword(id);
  return ok(res, null, "Senha resetada para 123456");
}

module.exports = {
  buscarPorMatricula,
  listar,
  criar,
  atualizar,
  alterarStatus,
  alterarSenha,
  resetarSenha,
};
