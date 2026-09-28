// Satu-satunya tempat yang membaca process.env. Semua modul lain memakai require('../config').
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const bool = (v, def = false) => (v == null || v === '' ? def : /^(1|true|ya|yes|on)$/i.test(String(v)));
const int = (v, def) => (Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : def);
const list = (v) => String(v || '').split(',').map((x) => x.trim()).filter(Boolean);
const PLACEHOLDERS = new Set(['masukkan', 'ganti', 'your_key', 'changeme', 'todo', 'none', 'x']);

function secret(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  const normalized = s.toLowerCase().replace(/[_\-]/g, ' ');
  if (PLACEHOLDERS.has(normalized) || normalized.startsWith('masukkan') || normalized.startsWith('ganti')) return '';
  return s;
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: int(process.env.PORT, 3000),
  publicBaseUrl: String(process.env.PUBLIC_BASE_URL || '').replace(/\/$/, ''),
  appApiKey: secret(process.env.APP_API_KEY),
  logLevel: process.env.LOG_LEVEL || 'info',
  trustProxy: bool(process.env.TRUST_PROXY, false),
  paypal: {
    clientId: secret(process.env.PAYPAL_CLIENT_ID),
    clientSecret: secret(process.env.PAYPAL_CLIENT_SECRET),
    mode: process.env.PAYPAL_MODE === 'live' ? 'live' : 'sandbox',
    idrPerUsd: Number(process.env.PAYPAL_IDR_PER_USD) || 0,
  },

  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: int(process.env.DB_PORT, 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'ai_employee_umkm',
    connectionLimit: int(process.env.DB_POOL_SIZE, 10),
  },

  // Urutan percobaan model AI. Provider otomatis dilewati bila kredensialnya kosong.
  ai: {
    order: list(process.env.AI_PROVIDER_ORDER).length
      ? list(process.env.AI_PROVIDER_ORDER)
      : ['gemini', 'groq', 'freebuff'],
    requestTimeoutMs: int(process.env.AI_TIMEOUT_MS, 45000),
    maxSteps: int(process.env.AI_MAX_STEPS, 5),
    temperature: Number(process.env.AI_TEMPERATURE ?? 0.2),
    maxTokens: int(process.env.AI_MAX_TOKENS, 900),
    providerPriority: list(process.env.AI_PROVIDER_PRIORITY),
    agentProviders: {
      customer_service: String(process.env.AI_PROVIDER_SARI || 'gemini').trim().toLowerCase(),
      finance: String(process.env.AI_PROVIDER_FINANCE || 'gemini').trim().toLowerCase(),
      inventory: String(process.env.AI_PROVIDER_INVENTORY || 'gemini').trim().toLowerCase(),
      marketing: String(process.env.AI_PROVIDER_MARKETING || 'gemini').trim().toLowerCase(),
    },
    groq: {
      apiKey: secret(process.env.GROQ_API_KEY),
      baseUrl: (process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/$/, ''),
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
      sttModel: process.env.GROQ_STT_MODEL || 'whisper-large-v3-turbo',
    },
    gemini: {
      apiKey: secret(process.env.GEMINI_API_KEY) || secret(process.env.GOOGLE_AI_STUDIO_KEY),
      baseUrl: (process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, ''),
      model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
    },
    // Freebuff/Codebuff tidak menyediakan REST API langsung; pakai adapter OpenAI-compatible
    // (mis. freebuff2api di http://127.0.0.1:8000/v1 atau freebuff-proxy di :3457/v1).
    freebuff: {
      apiKey: secret(process.env.FREEBUFF_API_KEY),
      baseUrl: (process.env.FREEBUFF_BASE_URL || 'http://127.0.0.1:8000/v1').replace(/\/$/, ''),
      model: process.env.FREEBUFF_MODEL || 'deepseek/deepseek-v4-flash',
    },
    stt: {
      // "auto" = pakai STT provider pertama yang punya kredensial; "browser" = hanya transkrip dari browser.
      mode: process.env.STT_MODE || 'auto',
      genericUrl: process.env.STT_API_URL || '',
      genericKey: secret(process.env.STT_API_KEY),
    },
    image: {
      url: process.env.IMAGE_API_URL || '',
      key: secret(process.env.IMAGE_API_KEY),
    },
  },

  telegram: {
    token: secret(process.env.TELEGRAM_BOT_TOKEN),
    ownerIds: list(process.env.TELEGRAM_OWNER_IDS),
    mode: process.env.TELEGRAM_MODE === 'webhook' ? 'webhook' : 'polling',
    webhookSecret: secret(process.env.TELEGRAM_WEBHOOK_SECRET),
    pollTimeoutSec: int(process.env.TELEGRAM_POLL_TIMEOUT, 25),
  },

  whatsapp: {
    token: secret(process.env.WHATSAPP_TOKEN),
    phoneId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
    appSecret: secret(process.env.WHATSAPP_APP_SECRET),
    owners: list(process.env.WHATSAPP_OWNER_NUMBERS),
    graphVersion: process.env.WHATSAPP_GRAPH_VERSION || 'v24.0',
  },

  limits: {
    customerMessagesPerMinute: int(process.env.CHAT_RATE_LIMIT_CUSTOMER, 12),
    ownerMessagesPerMinute: int(process.env.CHAT_RATE_LIMIT_OWNER, 60),
    maxCustomerQtyPerProduct: int(process.env.MAX_CUSTOMER_QTY, 20),
  },
};

module.exports = env;
