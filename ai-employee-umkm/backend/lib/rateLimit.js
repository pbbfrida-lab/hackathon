// Rate limiter fixed-window berbasis memori, untuk melindungi kuota free tier AI.
// Cukup untuk satu proses Express; kalau dijalankan multi-instance, ganti dengan Redis.
const config = require('../config');

function createLimiter({ windowMs = 60_000, max = 10, keyFn, message = 'Terlalu banyak permintaan. Coba lagi sebentar lagi.', messageFn = null } = {}) {
  const buckets = new Map();
  const MAX_BUCKETS = 20_000;

  function hit(key) {
    const now = Date.now();
    const entry = buckets.get(key);
    if (!entry || now >= entry.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      if (buckets.size > MAX_BUCKETS) buckets.delete(buckets.keys().next().value);
      return { allowed: true, remaining: max - 1, retryAfter: 0 };
    }
    entry.count += 1;
    if (buckets.size > MAX_BUCKETS) buckets.delete(buckets.keys().next().value);
    const allowed = entry.count <= max;
    return {
      allowed,
      remaining: Math.max(0, max - entry.count),
      retryAfter: allowed ? 0 : Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  return function limit(req, res, next) {
    const key = keyFn(req);
    const { allowed, remaining, retryAfter } = hit(key);
    res.set('X-RateLimit-Limit', String(max));
    res.set('X-RateLimit-Remaining', String(remaining));
    if (allowed) return next();
    res.set('Retry-After', String(retryAfter));
    // messageFn dipakai kalau pesan 429 harus menyesuaikan bahasa peminta.
    return res.status(429).json({ error: messageFn ? messageFn(req) : message, retry_after_seconds: retryAfter });
  };
}

/**
 * Kunci berbasis alamat IP.
 * X-Forwarded-For HANYA dipercaya bila server memang dijalankan di belakang reverse proxy
 * (TRUST_PROXY=true). Tanpa itu, pengunjung bisa awoke rate limit dengan mengarang header.
 */
const clientIp = (req) => {
  if (config.trustProxy) {
    const forwarded = req.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
};

module.exports = { createLimiter, clientIp };
