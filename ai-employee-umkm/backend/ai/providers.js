// Registry provider AI.
//
// Semua key gratis (Groq, Google AI Studio, Freebuff) bisa diisi sebagian saja:
// provider yang kredensialnya kosong otomatis dilewati, dan provider yang error
// atau kena rate limit otomatis dipindahkan ke urutan berikutnya (failover).
// Mode tanpa satu pun key yang valid -> orchestrator memakai mode demo berbasis aturan.
const config = require('../config');
const logger = require('../lib/logger').create('ai');
const { createOpenAiCompatProvider } = require('./providers/openaiCompat');
const gemini = require('./providers/gemini');

const PROVIDERS = [
  createOpenAiCompatProvider({
    id: 'groq',
    label: 'Groq (Llama)',
    baseUrl: config.ai.groq.baseUrl,
    getKey: () => config.ai.groq.apiKey,
    getModel: () => config.ai.groq.model,
    keyHint: 'https://console.groq.com/keys',
  }),
  gemini,
  createOpenAiCompatProvider({
    id: 'freebuff',
    label: 'Freebuff (proxy OpenAI-compatible)',
    baseUrl: config.ai.freebuff.baseUrl,
    getKey: () => config.ai.freebuff.apiKey,
    getModel: () => config.ai.freebuff.model,
    keyHint: 'Jalankan adapter freebuff2api / freebuff-proxy, lalu isi FREEBUFF_BASE_URL',
  }),
];

const byId = new Map(PROVIDERS.map((p) => [p.id, p]));

// Status runtime per provider: gagal N kali berturut-turut -> dinonaktifkan sementara (cooldown).
const state = new Map(PROVIDERS.map((p) => [p.id, { failures: 0, disabledUntil: 0, lastError: null, lastUsedAt: null, lastOkAt: null }]));

const COOLDOWN_MS = 90_000;
const FAILURE_THRESHOLD = 3;

function ordered() {
  const now = Date.now();
  const requested = config.ai.order.filter((id) => byId.has(id));
  const rest = PROVIDERS.filter((p) => !requested.includes(p.id));
  const all = [...requested.map((id) => byId.get(id)), ...rest];
  const manualFirst = config.ai.providerPriority.filter((id) => byId.has(id));
  return [
    ...manualFirst.map((id) => byId.get(id)),
    ...all.filter((p) => !manualFirst.includes(p.id)),
  ];
}

function isUsable(provider, now = Date.now()) {
  if (!provider.isConfigured()) return false;
  return (state.get(provider.id).disabledUntil || 0) <= now;
}

function markSuccess(provider) {
  const s = state.get(provider.id);
  Object.assign(s, { failures: 0, disabledUntil: 0, lastError: null, lastOkAt: Date.now() });
}

function markFailure(provider, err) {
  const s = state.get(provider.id);
  s.failures += 1;
  s.lastError = err.message;
  if (s.failures >= FAILURE_THRESHOLD) {
    s.disabledUntil = Date.now() + COOLDOWN_MS;
    logger.warn(`provider ${provider.id} dinonaktifkan ${COOLDOWN_MS / 1000}s setelah ${s.failures} gagal: ${err.message}`);
  }
}

/** Daftar provider yang saat ini bisa dipakai (berhasil konfigurasi + tidak dalam cooldown). */
function available() {
  const now = Date.now();
  return ordered().filter((p) => isUsable(p, now));
}

/** Provider yang mencoba gagal terakhir ini — dipakai sebagai "last resort" agar pesannya jelas. */
function lastAttempt() {
  const now = Date.now();
  return ordered().find((p) => p.isConfigured() && (state.get(p.id).disabledUntil || 0) <= now) || null;
}

function isLive() {
  return available().length > 0;
}

function activeId() {
  const list = available();
  return list.length ? list[0].id : 'demo';
}

/**
 * Jalankan satu panggilan chat dengan failover.
 * Melempar error terakhir bila tidak ada provider yang berhasil.
 */
async function chat(params) {
  const candidates = available();
  if (!candidates.length) {
    const err = new Error('Tidak ada provider AI yang siap. Isi minimal satu API key di .env (GROQ_API_KEY / GEMINI_API_KEY / FREEBUFF_API_KEY).');
    err.statusCode = 503;
    err.expose = true;
    throw err;
  }

  let lastError = null;
  for (const provider of candidates) {
    try {
      const started = Date.now();
      const result = await provider.chat(params);
      markSuccess(provider);
      state.get(provider.id).lastUsedAt = Date.now();
      logger.debug(`${provider.id} menjawab dalam ${Date.now() - started}ms (model ${result.model})`);
      return result;
    } catch (err) {
      lastError = err;
      markFailure(provider, err);
      logger.warn(`provider ${provider.id} gagal, pindah ke provider berikutnya: ${err.message}`);
    }
  }
  const err = new Error(`Semua provider AI gagal. Error terakhir: ${lastError ? lastError.message : 'tidak diketahui'}`);
  err.statusCode = 502;
  err.expose = true;
  throw err;
}

/** Ringkasan status provider untuk /api/health dan /api/ai/providers. */
function status() {
  const now = Date.now();
  return ordered().map((p) => {
    const s = state.get(p.id);
    return {
      id: p.id,
      label: p.label,
      kind: p.kind,
      configured: p.isConfigured(),
      available: isUsable(p, now),
      model: p.id === 'gemini' ? config.ai.gemini.model : p.id === 'groq' ? config.ai.groq.model : config.ai.freebuff.model,
      failures: s.failures,
      disabled_until: s.disabledUntil > now ? s.disabledUntil : null,
      last_error: s.lastError,
      last_ok_at: s.lastOkAt,
      key_hint: s.lastError ? p.keyHint : undefined,
    };
  });
}

/** Uji satu provider dengan panggilan kecil. Dipakai oleh `npm run doctor`. */
async function check(providerId) {
  const provider = byId.get(providerId);
  if (!provider) throw new Error(`Provider "${providerId}" tidak dikenal. Pilihan: ${[...byId.keys()].join(', ')}`);
  const started = Date.now();
  try {
    const detail = await provider.health();
    markSuccess(provider);
    return { id: provider.id, ok: true, ms: Date.now() - started, detail: detail.detail };
  } catch (err) {
    markFailure(provider, err);
    return { id: provider.id, ok: false, ms: Date.now() - started, detail: err.message, hint: provider.keyHint };
  }
}

function checkAll() {
  return Promise.all(ordered().map((p) => check(p.id)));
}

/** Reset status (dipakai tes/manual). */
function reset() {
  for (const s of state.values()) Object.assign(s, { failures: 0, disabledUntil: 0, lastError: null });
}

module.exports = {
  chat, isLive, activeId, available, status, check, checkAll, reset, lastAttempt,
  providers: PROVIDERS.map((p) => p.id),
};
