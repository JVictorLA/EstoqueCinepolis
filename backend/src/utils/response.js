/**
 * Padroniza respostas JSON: { success, message, data, error }
 */
function ok(res, data = null, message = "OK", status = 200) {
  return res.status(status).json({
    success: true,
    message,
    data,
    error: null,
  });
}

function created(res, data = null, message = "Criado com sucesso") {
  return ok(res, data, message, 201);
}

function fail(res, status, message, error = null) {
  return res.status(status).json({
    success: false,
    message,
    data: null,
    error: error || message,
  });
}

module.exports = { ok, created, fail };
