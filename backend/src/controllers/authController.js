const jwt = require("jsonwebtoken");
const config = require("../config");
const usuarioService = require("../services/usuarioService");
const { ok, fail } = require("../utils/response");

async function login(req, res) {
  const { matricula, senha } = req.body || {};

  if (!matricula || !senha) {
    return fail(res, 400, "Informe matrícula e senha");
  }

  const result = await usuarioService.validateCredentials(matricula, senha);

  if (!result) {
    return fail(res, 401, "Matrícula ou senha inválidos");
  }

  if (result.error === "inactive") {
    return fail(res, 403, "Usuário inativo");
  }

  if (result.tipo !== "admin") {
    return fail(res, 403, "Apenas administradores podem fazer login");
  }

  const token = jwt.sign(
    {
      sub: result.id,
      matricula: result.matricula,
      nome: result.nome,
      tipo: result.tipo,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

 return ok(
  res,
  {
    token,
    usuario: {
      id: result.id,
      matricula: result.matricula,
      nome: result.nome,
      email: result.email,
      tipo: result.tipo,
      ativo: !!result.ativo,

      precisaTrocarSenha: !!result.precisa_trocar_senha,
    },
  },
  "Login realizado"
);
}

module.exports = { login };