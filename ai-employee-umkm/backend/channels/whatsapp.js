// WhatsApp Business Cloud API (resmi dari Meta). Butuh URL webhook HTTPS publik (mis. ngrok / cloudflared).
const crypto = require('crypto');
const fs = require('fs');
const common = require('./common');
const stt = require('../../ai/voice/sttHandler');

const cfg = () => ({
  token: process.env.WHATSAPP_TOKEN,
  phoneId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
  appSecret: process.env.WHATSAPP_APP_SECRET,
  version: process.env.WHATSAPP_GRAPH_VERSION || 'v24.0',
});
const enabled = () => { const c = cfg(); return Boolean(c.token && c.phoneId); };
const owners = () => common.parseList(process.env.WHATSAPP_OWNER_NUMBERS).map(common.digits);
const graph = (p) => `https://graph.facebook.com/${cfg().version}/${p}`;
const auth = () => ({ Authorization: `Bearer ${cfg().token}` });

async function post(path, body, form) {
  const res = await fetch(graph(path), form
    ? { method: 'POST', headers: auth(), body: form }
    : { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`WhatsApp API ${res.status}: ${(data.error && data.error.message) || 'gagal'}`);
  return data;
}

async function sendText(to, text) {
  const s = String(text);
  for (let i = 0; i < Math.max(s.length, 1); i += 3800) {
    await post(`${cfg().phoneId}/messages`, { messaging_product: 'whatsapp', to, type: 'text', text: { body: s.slice(i, i + 3800) } });
  }
}

async function sendImage(to, image) {
  if (!image) return;
  if (image.pngFile) {
    const f = new FormData();
    f.append('messaging_product', 'whatsapp');
    f.append('type', 'image/png');
    f.append('file', new Blob([fs.readFileSync(image.pngFile)], { type: 'image/png' }), 'promo.png');
    const up = await post(`${cfg().phoneId}/media`, null, f);
    return post(`${cfg().phoneId}/messages`, { messaging_product: 'whatsapp', to, type: 'image', image: { id: up.id } });
  }
  if (image.remoteUrl) return post(`${cfg().phoneId}/messages`, { messaging_product: 'whatsapp', to, type: 'image', image: { link: image.remoteUrl } });
  return sendText(to, 'Poster sudah dibuat dan tersimpan di dashboard (WhatsApp tidak mendukung SVG; pasang paket "sharp" agar poster dikirim sebagai PNG).');
}

async function downloadMedia(mediaId) {
  const meta = await (await fetch(graph(mediaId), { headers: auth() })).json();
  if (!meta.url) throw new Error('URL media tidak ditemukan');
  const res = await fetch(meta.url, { headers: auth() });
  if (!res.ok) throw new Error('Gagal mengunduh media');
  return { base64: Buffer.from(await res.arrayBuffer()).toString('base64'), mime: meta.mime_type };
}

// GET: handshake verifikasi webhook dari Meta.
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
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(req.rawBody).digest('hex');
  const got = req.get('x-hub-signature-256') || '';
  return got.length === expected.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

let warnedNoSecret = false;
async function receive(req, res) {
  if (!enabled()) return res.sendStatus(403);
  const { appSecret } = cfg();
  const signed = signatureValid(req);
  if (appSecret && !signed) return res.sendStatus(401);
  if (!appSecret && !warnedNoSecret) {
    warnedNoSecret = true;
    console.warn('WHATSAPP_APP_SECRET kosong: tanda tangan webhook tidak diverifikasi, jadi fitur pemilik dinonaktifkan (semua pengirim = pelanggan).');
  }
  res.sendStatus(200); // balas cepat; proses di latar belakang

  const body = req.body || {};
  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      const names = {};
      (value.contacts || []).forEach((c) => { names[c.wa_id] = c.profile && c.profile.name; });
      for (const msg of value.messages || []) {
        handleMessage(msg, names[msg.from], signed).catch((e) => console.error('WhatsApp error:', e.message));
      }
    }
  }
}

async function handleMessage(msg, name, signed) {
  if (common.isDuplicate(`wa:${msg.id}`)) return;
  const from = common.digits(msg.from);
  post(`${cfg().phoneId}/messages`, { messaging_product: 'whatsapp', status: 'read', message_id: msg.id }).catch(() => {});

  try {
    let text = msg.type === 'text' && msg.text ? String(msg.text.body || '').trim() : '';
    if (!text && msg.type === 'audio' && msg.audio) {
      try {
        const media = await downloadMedia(msg.audio.id);
        text = await stt.transcribe({ audioBase64: media.base64, mimeType: media.mime });
        await sendText(from, `Saya dengar: "${text}"`);
      } catch (e) {
        return await sendText(from, 'Maaf, pesan suara belum bisa diproses. Silakan kirim teks.');
      }
    }
    if (!text) return await sendText(from, 'Saya baru bisa membaca pesan teks dan pesan suara.');
    if (/^(halo|hai|hi|start|menu)$/i.test(text)) return await sendText(from, common.WELCOME);

    const isOwner = signed && owners().includes(from);
    const result = await common.processMessage({
      channel: 'whatsapp', senderId: from, senderName: name, verifiedPhone: from, isOwner, text,
    });
    await sendText(from, result.reply);
    if (result.image && isOwner) await sendImage(from, result.image);
  } catch (e) {
    console.error('WhatsApp error:', e.message);
    sendText(from, 'Maaf, terjadi kendala. Coba lagi sebentar lagi.').catch(() => {});
  }
}

function start() {
  if (!enabled()) return;
  console.log('WhatsApp Cloud API aktif (menunggu webhook di /webhook/whatsapp).');
  // Catatan: pesan proaktif ke pemilik hanya berhasil jika pemilik chat dalam 24 jam terakhir.
  common.registerNotifier((text) => Promise.all(owners().map((n) => sendText(n, text))));
  if (!cfg().verifyToken) console.warn('WHATSAPP_VERIFY_TOKEN kosong: verifikasi webhook Meta akan gagal.');
}

module.exports = { enabled, start, verify, receive, handleMessage, sendText };
