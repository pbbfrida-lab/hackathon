// Rute AI: chat, perintah suara, dan pembuat poster.
// Semua respons memakai bentuk yang sudah dipahami dashboard dan halaman chat:
// { reply, agent, staff, mode, actions, orders, imageUrl }
const express = require('express');
const { asyncHandler, badRequest, notFound } = require('../lib/errors');
const { resolveLang } = require('../lib/i18n');
const { requireString, optionalString } = require('../lib/validate');
const agent = require('../ai/agent');
const sessions = require('../ai/sessions');
const voice = require('../ai/voice');
const poster = require('../ai/poster');
const providers = require('../ai/providers');
const products = require('../domain/products');
const staff = require('../domain/staff');

const router = express.Router();
const MAX_MESSAGE = 1000;

/** Jalankan satu pesan sebagai pemilik (dashboard) dan simpan ke riwayat sesi. */
async function runAsOwner(sessionId, message, lang, agentKey) {
  const result = await agent.handle({
    message,
    agentKey,
    history: sessions.get(sessionId),
    role: 'owner',
    lang,
    context: { channel: 'web' },
  });
  sessions.push(sessionId, 'user', message);
  sessions.push(sessionId, 'assistant', result.reply);
  const { image, ...publicResult } = result; // path file lokal tidak perlu dikirim ke browser
  return publicResult;
}

router.post('/chat', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const message = requireString(body.message, 'message', { max: MAX_MESSAGE });
  const sessionId = requireString(body.sessionId || 'dashboard', 'sessionId', { max: 64 });
  const agentKey = body.agentKey == null ? undefined : requireString(body.agentKey, 'agentKey', { max: 40 });
  res.json(await runAsOwner(sessionId, message, resolveLang(req), agentKey));
}));

router.post('/voice', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const sessionId = requireString(body.sessionId || 'dashboard', 'sessionId', { max: 64 });
  const agentKey = body.agentKey == null ? undefined : requireString(body.agentKey, 'agentKey', { max: 40 });
  const { text, via } = await voice.transcribe({
    transcript: body.transcript,
    audioBase64: body.audioBase64,
    mimeType: body.mimeType,
  });
  const result = await runAsOwner(sessionId, text, resolveLang(req), agentKey);
  res.json({ transcript: text, transcribedBy: via, ...result });
}));


router.post('/promo', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const productName = requireString(body.productName || body.product_name, 'productName', { max: 150 });
  const product = await products.findByName(productName);
  if (!product) {
    const suggestions = await products.search(productName, 3);
    throw notFound(`Produk tidak ditemukan: ${productName}.${suggestions.length ? ` Mungkin: ${suggestions.map((p) => p.name).join(', ')}` : ''}`);
  }
  const headline = optionalString(body.headline, 'headline', { max: 80 });
  const style = optionalString(body.style, 'style', { max: 80 });

  const result = await staff.withTask('marketing', `Membuat poster ${product.name}`, () => poster.generatePromo({ product, headline, style }));
  const { file, ...publicResult } = result; // jangan bocorkan path filesystem
  res.json(publicResult);
}));

// --- Diagnostics: status tiap provider AI ----------------------------------
router.get('/providers', (req, res) => {
  res.json({
    active: providers.activeId(),
    live: providers.isLive(),
    agentPreferences: providers.agentPreferences(),
    providers: providers.status(),
  });
});

router.post('/providers/check', asyncHandler(async (req, res) => {
  const only = (req.body || {}).provider;
  const results = only ? [await providers.check(requireString(only, 'provider', { max: 30 }))] : await providers.checkAll();
  res.json({ checked_at: new Date().toISOString(), results });
}));

router.get('/sessions', (req, res) => res.json(sessions.stats()));

router.delete('/sessions/:id', (req, res) => {
  sessions.clear(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
module.exports.runAsOwner = runAsOwner;
