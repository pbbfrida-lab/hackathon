// Error HTTP terpusat: controller cukup melempar, errorHandler yang memformat respons.
class HttpError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.expose = true;
    if (details) this.details = details;
  }
}

const badRequest = (msg, details) => new HttpError(400, msg, details);
const unauthorized = (msg = 'API key tidak valid atau belum dikirim.') => new HttpError(401, msg);
const forbidden = (msg = 'Akses ditolak.') => new HttpError(403, msg);
const notFound = (msg = 'Data tidak ditemukan.') => new HttpError(404, msg);
const conflict = (msg) => new HttpError(409, msg);
const badGateway = (msg) => new HttpError(502, msg);

function notFoundHandler(req, res) {
  res.status(404).json({ error: `Rute tidak ditemukan: ${req.method} ${req.originalUrl}` });
}

// Error dengan `expose`true (HttpError dan error domain) boleh tampil apa adanya ke pengguna.
// Error lain disembunyikan agar tidak membocorkan detail internal (kredensial, SQL, stack).
function errorHandler(err, req, res, _next) {
  const status = err.statusCode || err.status || 500;
  const isClientError = status < 500;
  if (!isClientError) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  }
  const body = { error: isClientError || err.expose ? err.message : `Terjadi kesalahan server: ${err.message}` };
  if (err.details) body.details = err.details;
  res.status(status).json(body);
}

// Bungkus handler async supaya rejection masuk ke errorHandler, bukan menggagalkan proses.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = {
  HttpError, asyncHandler,
  badRequest, unauthorized, forbidden, notFound, conflict, badGateway,
  notFoundHandler, errorHandler,
};
