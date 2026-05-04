const usuarioService = require("../services/usuarioService");
const { ok, created, fail } = require("../utils/response");

async function listar(_req, res) {
  const rows = await usuarioService.listAll();
  return ok(res, rows);
}

async function criar(req, res) {
  const { matricula, nome, email, senha, tipo, ativo } = req.body || {};
  if (!matricula || !nome || !senha || !tipo) {
    return fail(res, 400, "matricula, nome, senha e tipo são obrigatórios");
  }
  if (!["admin", "operador"].includes(tipo)) {
    return fail(res, 400, "tipo deve ser 'admin' ou 'operador'");
  }
  if (await usuarioService.existsByMatricula(matricula)) {
    return fail(res, 409, "Matrícula já cadastrada");
  }
  const novo = await usuarioService.create({
    matricula: String(matricula).trim(),
    nome: String(nome).trim(),
    email: email ? String(email).trim() : null,
    senha,
    tipo,
    ativo: ativo === undefined ? true : !!ativo,
  });
  return created(res, novo, "Usuário criado");
}

async function atualizar(req, res) {
  const id = Number(req.params.id);
  if (!id) return fail(res, 400, "id inválido");
  const existing = await usuarioService.findById(id);
  if (!existing) return fail(res, 404, "Usuário não encontrado");

  const { matricula, nome, email, senha, tipo, ativo } = req.body || {};
  if (tipo && !["admin", "operador"].includes(tipo)) {
    return fail(res, 400, "tipo deve ser 'admin' ou 'operador'");
  }
  if (matricula && matricula !== existing.matricula) {
    if (await usuarioService.existsByMatricula(matricula)) {
      return fail(res, 409, "Matrícula já cadastrada");
    }
  }
  const atualizado = await usuarioService.update(id, {
    matricula, nome, email, senha, tipo, ativo,
  });
  return ok(res, atualizado, "Usuário atualizado");
}

async function alterarStatus(req, res) {
  const id = Number(req.params.id);
  if (!id) return fail(res, 400, "id inválido");
  const { ativo } = req.body || {};
  if (ativo === undefined) return fail(res, 400, "Informe 'ativo' (true/false)");
  const existing = await usuarioService.findById(id);
  if (!existing) return fail(res, 404, "Usuário não encontrado");
  const atualizado = await usuarioService.setStatus(id, !!ativo);
  return ok(res, atualizado, "Status atualizado");
}

module.exports = { listar, criar, atualizar, alterarStatus };
