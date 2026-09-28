const express = require('express');
const orchestrator = require('../../ai/agent/orchestrator');
const sessions = require('../../ai/agent/sessions');
const stt = require('../../ai/voice/sttHandler');
const imgGenerator = require('../../ai/image/imgGenerator');
const productModel = require('../../modules/products/productModel');
const staffStatus = require('../../modules/employees/staffStatus');
const { httpError } = require('../middleware/errorHandler');

const router = express.Router();
const w = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

async function handleMessage(sessionId, message) {
  const result = await orchestrator.handle({ message, history: sessions.get(sessionId), role: 'owner', context: { channel: 'web' } });
  sessions.push(sessionId, 'user', message);
  sessions.push(sessionId, 'assistant', result.reply);
  const { image, ...publicResult } = result; // path file lokal tidak dikirim ke browser
  return publicResult;
}

router.post('/chat', w(async (req, res) => {
  const { message, sessionId = 'default' } = req.body || {};
  if (!message || !String(message).trim()) throw httpError(400, 'Pesan tidak boleh kosong.');
  res.json(await handleMessage(sessionId, String(message).trim()));
}));

// Perintah suara: kirim transkrip dari browser, atau audio base64 jika STT_API_URL diatur.
router.post('/voice', w(async (req, res) => {
  const { transcript, audioBase64, mimeType, sessionId = 'default' } = req.body || {};
  const text = await stt.transcribe({ transcript, audioBase64, mimeType });
  const result = await handleMessage(sessionId, text);
  res.json({ transcript: text, ...result });
}));

router.post('/promo', w(async (req, res) => {
  const { productName, headline, style } = req.body || {};
  const product = await productModel.findByName(productName);
  if (!product) throw httpError(404, `Produk tidak ditemukan: ${productName}`);
  staffStatus.setWorking('marketing', `Membuat poster ${product.name}`);
  try {
    res.json(await imgGenerator.generatePromo({ product, headline, style }));
  } finally {
    staffStatus.setIdle('marketing');
  }
}));

module.exports = router;
