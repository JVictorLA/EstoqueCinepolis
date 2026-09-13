const jwt = require("jsonwebtoken");
const config = require("../config");
const usuarioService = require("../services/usuarioService");
const { ok, fail } = require("../utils/response");

function scaleFail(res, status, message) {
  return res.status(status).json({
    success: false,
    message,
  });
}

function buildScaleToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      matricula: user.matricula,
      nome: user.nome,
      tipo: user.tipo,
      aud: "zytrex-scale",
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn },
  );
}

async function login(req, res) {
  const { matricula, senha } = req.body || {};

  if (!matricula || !senha) {
    return fail(res, 400, "Informe matricula e senha");
  }

  const result = await usuarioService.validateCredentials(matricula, senha);

  if (!result) {
    return fail(res, 401, "Matrícula ou senha inválidos");
  }

  if (result.error === "inactive") {
    return fail(res, 403, "Usuário inativo");
  }

  if (result.error === "locked") {
    return res.status(403).json({
      success: false,
      message: result.message,
      data: {
        usuario_bloqueado_temporariamente: true,
        retry_after_seconds: result.retry_after_seconds,
        aviso_ultimas_tentativas_apos_timer: !!result.aviso_ultimas_tentativas_apos_timer,
      },
      error: result.message,
    });
  }

  if (result.error === "disabled_by_password_attempts") {
    return res.status(result.status || 403).json({
      success: false,
      message: result.message,
      data: {
        usuario_desabilitado_por_senha: true,
      },
      error: result.message,
    });
  }

  if (result.password_status) {
    const message =
      result.password_status === "expired"
        ? "Sua senha expirou. Troque-a para continuar."
        : "Primeiro acesso detectado. Troque a senha para continuar.";

    return res.status(403).json({
      success: false,
      message,
      data: usuarioService.buildPasswordChallenge(result),
      error: message,
    });
  }

  if (!["admin", "master"].includes(result.tipo)) {
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
    { expiresIn: config.jwt.expiresIn },
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
        themePreference: result.theme_preference === "dark" ? "dark" : "light",
        precisaTrocarSenha: !!result.precisa_trocar_senha,
        senhaExpirada: !!result.senha_expirada,
        passwordWarning: result.password_warning || null,
      },
    },
    "Login realizado",
  );
}

async function scaleLogin(req, res) {
  const { matricula, senha } = req.body || {};

  if (!matricula || !senha) {
    return scaleFail(res, 400, "Informe matricula e senha");
  }

  const result = await usuarioService.validateCredentials(matricula, senha);

  if (!result) {
    return scaleFail(res, 401, "Matricula ou senha invalidos");
  }

  if (result.error === "inactive") {
    return scaleFail(res, 403, "Usuario inativo");
  }

  if (result.error === "locked") {
    return scaleFail(res, 403, result.message);
  }

  if (result.error === "disabled_by_password_attempts") {
    return scaleFail(res, result.status || 403, result.message);
  }

  if (result.password_status) {
    const message =
      result.password_status === "expired"
        ? "Senha vencida. Troque a senha no Zytrex Inventory para continuar."
        : "Troca de senha obrigatoria no Zytrex Inventory.";

    return scaleFail(res, 403, message);
  }

  if (!["admin", "master"].includes(result.tipo)) {
    return scaleFail(res, 403, "Acesso permitido apenas para administradores autorizados");
  }

  return res.json({
    success: true,
    usuario: {
      id: result.id,
      nome: result.nome,
      matricula: result.matricula,
      tipo: result.tipo,
    },
    token: buildScaleToken(result),
  });
}

module.exports = { login, scaleLogin };
