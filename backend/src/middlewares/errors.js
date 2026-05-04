const { fail } = require("../utils/response");

// 404 para rotas não encontradas
function notFound(req, res) {
  return fail(res, 404, `Rota não encontrada: ${req.method} ${req.originalUrl}`);
}

// Handler global de erros
function errorHandler(err, req, res, _next) {
  // eslint-disable-next-line no-console
  console.error("[ERROR]", err);

  const status = err.status || 500;
  const message = err.message || "Erro interno do servidor";

  return res.status(status).json({
    success: false,
    message,
    data: null,
    error: process.env.NODE_ENV === "production" ? message : err.stack || message,
  });
}

module.exports = { notFound, errorHandler };
