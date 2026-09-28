// Validasi input ringan. Tujuannya menolak data rusak sedini mungkin dengan pesan Bahasa Indonesia.
const { badRequest } = require('./errors');

function requireString(value, field, { min = 1, max = 255 } = {}) {
  const s = typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
  if (s.length < min) throw badRequest(`${field} wajib diisi.`);
  if (s.length > max) throw badRequest(`${field} maksimal ${max} karakter.`);
  return s;
}

function optionalString(value, field, { max = 255 } = {}) {
  if (value == null || String(value).trim() === '') return null;
  return requireString(value, field, { max });
}

function requireInt(value, field, { min = -Infinity, max = Infinity } = {}) {
  const n = Number(value);
  if (!Number.isInteger(n)) throw badRequest(`${field} harus bilangan bulat.`);
  if (n < min) throw badRequest(`${field} minimal ${min}.`);
  if (n > max) throw badRequest(`${field} maksimal ${max}.`);
  return n;
}

function requireEnum(value, field, allowed) {
  if (!allowed.includes(value)) throw badRequest(`${field} harus salah satu dari: ${allowed.join(', ')}`);
  return value;
}

function isoDate(value, field) {
  const s = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw badRequest(`${field} harus format YYYY-MM-DD.`);
  return s;
}

function requireId(value, field = 'id') {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw badRequest(`${field} tidak valid.`);
  return n;
}

function pagination(query, { defaultLimit = 50, maxLimit = 200 } = {}) {
  const limit = Math.min(Math.max(Number(query.limit) || defaultLimit, 1), maxLimit);
  return { limit };
}

module.exports = { requireString, optionalString, requireInt, requireEnum, isoDate, requireId, pagination };
