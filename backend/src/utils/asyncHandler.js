/**
 * Wrapper async para controllers — captura erros e envia ao errorHandler.
 */
module.exports = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
