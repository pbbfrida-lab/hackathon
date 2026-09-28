// Request log ringkas: metode, path, status, durasi. Query string disembunyikan agar token tidak bocor di log.
const logger = require('../lib/logger').create('http');

const logRequests = (req, res, next) => {
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'debug';
    logger[level](`${req.method} ${req.originalUrl.split('?')[0]} ${res.statusCode} ${ms.toFixed(0)}ms`);
  });
  next();
};

module.exports = { logRequests };
