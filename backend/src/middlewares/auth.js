const jwt = require("jsonwebtoken");
const config = require("../config");
const { fail } = require("../utils/response");

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return fail(res, 401, "Token não informado");
  }

  try {
    const payload = jwt.verify(token, config.jwt.secret);
    req.user = {
      id: payload.sub,
      matricula: payload.matricula,
      nome: payload.nome,
      tipo: payload.tipo,
    };
    return next();
  } catch (e) {
    return fail(res, 401, "Token inválido ou expirado");
  }
}

function adminOnly(req, res, next) {
  if (!req.user) return fail(res, 401, "Não autenticado");
  if (!["admin", "master"].includes(req.user.tipo)) {
    return fail(res, 403, "Acesso restrito a administradores");
  }
  return next();
}

function masterOnly(req, res, next) {
  if (!req.user) return fail(res, 401, "Não autenticado");
  if (req.user.tipo !== "master") return fail(res, 403, "Acesso restrito ao master");
  return next();
}

module.exports = { authMiddleware, adminOnly, masterOnly };
