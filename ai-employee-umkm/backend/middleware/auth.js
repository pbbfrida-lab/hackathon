// Autentikasi API sederhana: hanya aktif bila APP_API_KEY diisi di .env.
// Header yang diterima: x-api-key, atau Authorization: Bearer <key>.
// Dibandingkan dengan timing-safe equality supaya tidak bocor lewat selisih waktu.
const crypto = require('crypto');
const config = require('../config');
const { unauthorized } = require('../lib/errors');

const PATHS_NEVER_LOCKED = ['/api/health'];

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function extractKey(req) {
  const header = req.get('x-api-key') || (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  return header.trim();
}

function requireApiKey(req, res, next) {
  if (!config.appApiKey) return next();
  if (PATHS_NEVER_LOCKED.includes(req.path)) return next();
  if (safeEqual(extractKey(req), config.appApiKey)) return next();
  return next(unauthorized(`API key tidak valid atau belum dikirim (header x-api-key).`));
}

/** Endpoint yang hanya untuk pemilik (dashboard), memakai key bila ada. */
function requireOwner(req, res, next) {
  if (!config.appApiKey) return next();
  if (safeEqual(extractKey(req), config.appApiKey)) return next();
  return next(unauthorized());
}

function isProtected() {
  return Boolean(config.appApiKey);
}

module.exports = { requireApiKey, requireOwner, isProtected, extractKey };
