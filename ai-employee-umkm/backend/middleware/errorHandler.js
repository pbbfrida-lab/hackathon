function notFound(req, res) {
  res.status(404).json({ error: `Rute tidak ditemukan: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.statusCode || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 && !err.expose ? `Terjadi kesalahan server: ${err.message}` : err.message });
}

function httpError(statusCode, message) {
  const e = new Error(message);
  e.statusCode = statusCode;
  e.expose = true;
  return e;
}

module.exports = { notFound, errorHandler, httpError };
