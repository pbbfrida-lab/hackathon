// WhatsApp Business Cloud API (resmi dari Meta).
// Wajib punya URL webhook HTTPS publik (ngrok / cloudflared). Berbeda dari Telegram,
// Meta hanya mengirim webhook sehingga butuh service tunnel.
const crypto = require('crypto');
const fs = require('fs');
const config = require('../config');
const logger = require('../lib/logger').create('whatsapp');
const channel = require('./context');
const voice = require('../ai/voice');

const cfg = () => ({
  token: config.whatsapp.token,
  phoneId: config.whatsapp.phoneId,
  verifyToken: config.whatsapp.verifyToken,
  appSecret: config.whatsapp.appSecret,
});

const enabled = () => Boolean(cfg().token && cfg().phoneId);
const graph = (p) => `https://graph.facebook.com/${config.whatsapp.graphVersion}/${p}`;
const auth = () => ({ Authorization: `Bearer ${cfg().token}` });
const digits = (v) => String(v || '').replace(/\D/g, '');
const isOwner = (from) => config.whatsapp.owners.map(digits).includes(digits(from));

async function post(path, body, form) {
  const res = await fetch(graph(path), form
    ? { method: 'POST', headers: auth(), body: form }
    : { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`WhatsApp API ${res.status}: ${(data.error && data.error.message) || 'gagal'}`);
  return data;
}

async function sendText(to, text) {
  const source = String(text || '');
  for (let i = 0; i < Math.max(source.length, 1); i += 3800) {
    await post(`${cfg().phoneId}/messages`, {
      messaging_product: 'whatsapp', to, type: 'text', text: { body: source.slice(i, i + 3800) || '-' },
    });
  }
}

async function sendImage(to, image) {
  if (!image) return;
  if (image.remoteUrl) {
    return post(`${cfg().phoneId}/messages`, { messaging_product: 'whatsapp', to, type: 'image', image: { link: image.remoteUrl } });
  }
  if (image.pngFile) {
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', 'image/png');
    form.append('file', new Blob([fs.readFileSync(image.pngFile)], { type: 'image/png' }), 'poster.png');
    const upload = await post(`${cfg().phoneId}/media`, null, form);
    return post(`${cfg().phoneId}/messages`, { messaging_product: 'whatsapp', to, type: 'image', image: { id: upload.id } });
  }
  return sendText(to, 'Poster sudah dibuat dan tersimpan di dashboard. Pasang paket "sharp" agar poster bisa dikirim sebagai PNG.');
}

async function downloadMedia(mediaId) {
  const metaRes = await fetch(graph(mediaId), { headers: auth() });
  const meta = await metaRes.json();
  if (!meta.url) throw new Error('URL media tidak ditemukan');
  const res = await fetch(meta.url, { headers: auth() });
  if (!res.ok) throw new Error('gagal mengunduh media');
  return { base64: Buffer.from(await res.arrayBuffer()).toString('base64'), mime: meta.mime_type };
}

/** Handshake verifikasi webhook dari Meta. */
function verify(req, res) {
  const { verifyToken } = cfg();
  if (verifyToken && req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === verifyToken) {
    return res.status(200).send(String(req.query['hub.challenge'] || ''));
  }
  return res.sendStatus(403);
}

function signatureValid(req) {
  const { appSecret } = cfg();
  if (!appSecret || !req.rawBody) return false;
  const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(req.rawBody).digest('hex')}`;
  const got = req.get('x-hub-signature-256') || '';
  return got.length === expected.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

let warnedNoSecret = false;

function receive(req, res) {
  if (!enabled()) return res.sendStatus(403);
  const { appSecret } = cfg();
  const signed = signatureValid(req);
  if (appSecret && !signed) return res.sendStatus(401); // tanda tangan tidak cocok = permintaan palsu
  if (!appSecret && !warnedNoSecret) {
    warnedNoSecret = true;
    logger.warn('WHATSAPP_APP_SECRET kosong: tanda tangan tidak diverifikasi, jadi semua pengirim diperlakukan sebagai pelanggan.');
  }
  res.sendStatus(200); // balas cepat sesuai syarat Meta, proses di latar belakang

  for (const entry of (req.body || {}).entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      const names = {};
      for (const contact of value.contacts || []) names[contact.wa_id] = contact.profile && contact.profile.name;
      for (const message of value.messages || []) {
        handleMessage(message, names[message.from], signed).catch((err) => logger.error(err.message));
      }
    }
  }
}

async function handleMessage(message, name, signed) {
  if (channel.isDuplicate(`wa:${message.id}`)) return;
  const from = digits(message.from);
  post(`${cfg().phoneId}/messages`, { messaging_product: 'whatsapp', status: 'read', message_id: message.id }).catch(() => {});

  try {
    let text = message.type === 'text' && message.text ? String(message.text.body || '').trim() : '';

    if (!text && message.type === 'audio' && message.audio) {
      try {
        const media = await downloadMedia(message.audio.id);
        const result = await voice.transcribe({ audioBase64: media.base64, mimeType: media.mime });
        text = result.text;
        await sendText(from, `Saya dengar: "${text}"`);
      } catch (err) {
        logger.warn('transkripsi audio gagal:', err.message);
        return sendText(from, 'Maaf, pesan suara belum bisa diproses. Silakan kirim teks.');
      }
    }
    if (!text) return sendText(from, 'Saya baru bisa membaca pesan teks dan pesan suara.');
    if (/^(halo|hai|hi|hello|start|menu|bantuan)$/i.test(text)) return sendText(from, channel.WELCOME);

    // Peran pemilik hanya diakui bila tanda tangan webhook terverifikasi.
    const owner = signed && isOwner(from);
    const result = await channel.processMessage({
      channel: 'whatsapp', senderId: from, senderName: name, verifiedPhone: from, isOwner: owner, text,
    });
    await sendText(from, result.reply);
    if (owner && result.image) await sendImage(from, result.image);
  } catch (err) {
    logger.error('gagal menangani pesan WhatsApp:', err);
    sendText(from, 'Maaf, terjadi kendala. Coba lagi sebentar lagi.').catch(() => {});
  }
}

function start() {
  if (!enabled()) {
    logger.info('WhatsApp nonaktif (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID kosong).');
    return;
  }
  logger.info(`WhatsApp Cloud API aktif (menunggu webhook di ${config.publicBaseUrl || 'PUBLIC_BASE_URL'}/webhook/whatsapp).`);
  // Pesan proaktif hanya sampai kalau pemilik membalas dalam 24 jam terakhir (kebijakan Meta).
  channel.registerNotifier((text) => Promise.all(config.whatsapp.owners.map((n) => sendText(n, text))));
  if (!cfg().verifyToken) logger.warn('WHATSAPP_VERIFY_TOKEN kosong: verifikasi webhook Meta akan gagal.');
}

module.exports = { enabled, start, verify, receive, handleMessage, sendText };
