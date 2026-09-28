// Pembungkus fetch untuk panggilan API AI: timeout, retry, dan pemetaan error yang jelas.
const config = require('../config');
const { badGateway } = require('../lib/errors');

const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

class ProviderError extends Error {
  constructor(message, { status = 502, provider = 'ai', retryable = false, cause = null } = {}) {
    super(message);
    this.name = 'ProviderError';
    this.statusCode = status;
    this.expose = false;
    this.provider = provider;
    this.retryable = retryable;
    if (cause) this.cause = cause;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function postJson(url, { headers = {}, body, provider = 'ai', timeoutMs = config.ai.requestTimeoutMs, retries = 1 }) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await res.text();
      let data = {};
      try { data = text ? JSON.parse(text) : {}; } catch { /* respons non-JSON */ }

      if (!res.ok) {
        const detail = extractError(data) || text.slice(0, 300);
        throw new ProviderError(`[${provider}] HTTP ${res.status}: ${detail || 'tanpa detail'}`, {
          status: res.status === 429 ? 429 : badGateway().statusCode,
          provider,
          retryable: RETRYABLE_STATUS.has(res.status),
        });
      }
      return data;
    } catch (err) {
      if (err instanceof ProviderError) {
        lastError = err;
        if (!err.retryable || attempt === retries) throw err;
      } else if (err.name === 'AbortError') {
        lastError = new ProviderError(`[${provider}] waktu habis setelah ${timeoutMs}ms`, { provider, retryable: true });
        if (attempt === retries) throw lastError;
      } else {
        lastError = new ProviderError(`[${provider}] gagal menghubungi server: ${err.message}`, {
          provider, retryable: true, cause: err,
        });
        if (attempt === retries) throw lastError;
      }
      await sleep(400 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

function extractError(data) {
  if (!data || typeof data !== 'object') return '';
  return (data.error && (data.error.message || (typeof data.error === 'string' ? data.error : '')))
    || data.message
    || data.detail
    || '';
}

module.exports = { postJson, ProviderError, sleep };
