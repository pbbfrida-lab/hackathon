const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');

const db = require('./services/db');
const metaAi = require('./services/metaAiService');
const authMiddleware = require('./middleware/authMiddleware');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const apiRoutes = require('./routes/apiRoutes');
const aiRoutes = require('./routes/aiRoutes');
const channelRoutes = require('./routes/channelRoutes');
const telegram = require('./channels/telegram');
const whatsapp = require('./channels/whatsapp');

const app = express();
const FRONTEND = path.resolve(__dirname, '../frontend');

app.use(cors());
// rawBody dibutuhkan untuk verifikasi tanda tangan webhook WhatsApp.
app.use(express.json({ limit: '10mb', verify: (req, res, buf) => { req.rawBody = buf; } }));

app.get('/api/health', async (req, res) => {
  let database = 'ok';
  try { await db.query('SELECT 1'); } catch (e) { database = `error: ${e.message}`; }
  res.json({
    status: 'ok',
    database,
    ai: metaAi.isConfigured() ? 'meta-ai' : 'mock',
    channels: {
      telegram: telegram.enabled() ? telegram.mode() : 'off',
      whatsapp: whatsapp.enabled() ? 'webhook' : 'off',
    },
  });
});

// Webhook kanal punya verifikasi sendiri (token/tanda tangan), jadi di luar authMiddleware.
app.use('/webhook', channelRoutes);

app.use('/api', authMiddleware);
app.use('/api', apiRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api', notFound);

app.use(express.static(FRONTEND));
app.get('/', (req, res) => res.redirect('/dashboard/'));
app.get('/chat', (req, res) => res.sendFile(path.join(FRONTEND, 'ai-chat', 'chat.html')));

app.use(errorHandler);

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, async () => {
  console.log(`OmniStaff AI berjalan di http://localhost:${PORT}`);
  console.log(`Mode AI: ${metaAi.isConfigured() ? 'Meta AI API' : 'demo (tanpa META_API_KEY)'}`);
  telegram.start().catch((e) => console.warn('Telegram gagal start:', e.message));
  whatsapp.start();
  try { await db.query('SELECT 1'); console.log('Database MySQL terhubung.'); }
  catch (e) { console.warn(`PERINGATAN: database belum terhubung (${e.message}). Jalankan: npm run db:init -- --seed`); }
});
