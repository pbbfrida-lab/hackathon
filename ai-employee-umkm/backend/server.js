// Titik masuk server OmniStaff AI.
//
// Urutan middleware penting:
//   cors -> json (dengan rawBody untuk verifikasi tanda tangan WhatsApp) -> log
//        -> /webhook/* (verifikasi sendiri, DI LUAR auth API)
//        -> /api/health (terbuka) -> /api/* (auth) -> 404 -> errorHandler
const path = require('path');
const express = require('express');
const cors = require('cors');

const config = require('./config');
const logger = require('./lib/logger').create('server');
const db = require('./db');
const { notFoundHandler, errorHandler } = require('./lib/errors');
const { requireApiKey } = require('./middleware/auth');
const { logRequests } = require('./middleware/requestLogger');
const apiRoutes = require('./routes/api');
const aiRoutes = require('./routes/ai');
const publicRoutes = require('./routes/public');
const telegram = require('./channels/telegram');
const whatsapp = require('./channels/whatsapp');
const providers = require('./ai/providers');

const FRONTEND_DIR = path.resolve(__dirname, '../frontend');
const MAX_BODY = '10mb';

function createApp() {
  const app = express();

  if (config.trustProxy) app.set('trust proxy', true);
  app.disable('x-powered-by');

  app.use(cors({ origin: true, credentials: false }));
  app.use(express.json({
    limit: MAX_BODY,
    // Meta menghitung HMAC tanda tangan dari body persis seperti yang dikirim.
    verify: (req, res, buf) => { req.rawBody = buf; },
  }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(logRequests);

  // --- Health check: terbuka supaya uptime monitor tidak butuh API key ---
  app.get('/api/health', async (req, res) => {
    let database = 'ok';
    try { await db.ping(); } catch (err) { database = `error: ${err.message}`; }
    res.json({
      status: 'ok',
      version: require('../package.json').version,
      uptime_seconds: Math.round(process.uptime()),
      database,
      ai: providers.isLive() ? providers.activeId() : 'demo',
      ai_providers: providers.status().map((p) => ({ id: p.id, configured: p.configured, available: p.available, model: p.model })),
      channels: {
        telegram: telegram.status(),
        whatsapp: whatsapp.enabled() ? 'webhook' : 'off',
      },
      auth: config.appApiKey ? 'api-key' : 'open',
    });
  });

  // --- Webhook kanal: verifikasi token/HMAC sendiri, bukan API key ---
  app.get('/webhook/whatsapp', whatsapp.verify);
  app.post('/webhook/whatsapp', whatsapp.receive);
  app.post('/webhook/telegram', telegram.webhook);

  // --- Endpoint publik (landing page + live CS) ---
  // BEFORE authMiddleware: pengunjung belum punya API key, dan peran mereka
  // sudah dibatasi ke 'customer' di dalam router ini.
  app.use('/api/public', publicRoutes);

  // --- API ---
  app.use('/api', requireApiKey);
  app.use('/api/ai', aiRoutes);
  app.use('/api', apiRoutes);
  app.use('/api', notFoundHandler);

  // --- Frontend statis ---
  app.use(express.static(FRONTEND_DIR, { extensions: ['html'] }));
  app.get('/', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'landing', 'index.html')));
  app.get('/chat', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'ai-chat', 'chat.html')));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

async function start() {
  const app = createApp();
  const server = await new Promise((resolve, reject) => {
    const s = app.listen(config.port, () => resolve(s));
    s.on('error', reject);
  });

  logger.info(`OmniStaff AI berjalan di http://localhost:${config.port}`);
  logger.info(`Mode AI: ${providers.isLive() ? providers.status().filter((p) => p.available).map((p) => `${p.id} (${p.model})`).join(' + ') : 'demo tanpa LLM'}`);
  logger.info(`Autentikasi API: ${config.appApiKey ? 'aktif (APP_API_KEY diisi)' : 'terbuka (isi APP_API_KEY untuk produksi)'}`);

  try {
    await db.ping();
    logger.info('Database MySQL terhubung.');
  } catch (err) {
    logger.warn(`Database belum terhubung (${err.message}). Jalankan: npm run db:init -- --seed`);
  }

  await telegram.start();
  whatsapp.start();

  const shutdown = async (signal) => {
    logger.info(`${signal} diterima, menutup server...`);
    telegram.stop();
    server.close(async () => {
      await db.close().catch(() => {});
      logger.info('Server ditutup.');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 8000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  return server;
}

if (require.main === module) {
  start().catch((err) => {
    if (err && err.code === 'EADDRINUSE') {
      logger.error(`Port ${config.port} sudah dipakai aplikasi lain. Ubah PORT di .env lalu jalankan ulang.`);
    } else {
      logger.error('Gagal menjalankan server:', err);
    }
    process.exit(1);
  });
}

module.exports = { createApp, start };
