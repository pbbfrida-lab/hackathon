// Bot Telegram. Mode default: long polling (tidak perlu URL publik). Mode webhook: butuh PUBLIC_BASE_URL (HTTPS).
const fs = require('fs');
const common = require('./common');
const stt = require('../../ai/voice/sttHandler');

const token = () => process.env.TELEGRAM_BOT_TOKEN;
const enabled = () => Boolean(token());
const mode = () => (process.env.TELEGRAM_MODE === 'webhook' ? 'webhook' : 'polling');
const owners = () => common.parseList(process.env.TELEGRAM_OWNER_IDS);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(method, body, form) {
  const res = await fetch(`https://api.telegram.org/bot${token()}/${method}`, form
    ? { method: 'POST', body: form }
    : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) throw new Error(`Telegram ${method}: ${data.description || res.status}`);
  return data.result;
}

function chunks(text, size = 4000) {
  const out = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out.length ? out : [''];
}

async function sendText(chatId, text) {
  for (const part of chunks(String(text))) await call('sendMessage', { chat_id: chatId, text: part });
}

async function sendImage(chatId, image) {
  if (!image) return;
  if (image.pngFile) {
    const f = new FormData();
    f.append('chat_id', String(chatId));
    f.append('photo', new Blob([fs.readFileSync(image.pngFile)], { type: 'image/png' }), 'promo.png');
    return call('sendPhoto', null, f);
  }
  if (image.remoteUrl) return call('sendPhoto', { chat_id: chatId, photo: image.remoteUrl });
  if (image.file) { // SVG: kirim sebagai dokumen
    const f = new FormData();
    f.append('chat_id', String(chatId));
    f.append('document', new Blob([fs.readFileSync(image.file)], { type: 'image/svg+xml' }), 'promo.svg');
    return call('sendDocument', null, f);
  }
}

async function downloadFile(fileId) {
  const info = await call('getFile', { file_id: fileId });
  const res = await fetch(`https://api.telegram.org/file/bot${token()}/${info.file_path}`);
  if (!res.ok) throw new Error('Gagal mengunduh file Telegram');
  return Buffer.from(await res.arrayBuffer()).toString('base64');
}

async function handleUpdate(update) {
  const m = update.message;
  if (!m || !m.chat || m.chat.type !== 'private') return; // hanya chat pribadi
  if (common.isDuplicate(`tg:${update.update_id}`)) return;
  const chatId = m.chat.id;
  const name = [m.from && m.from.first_name, m.from && m.from.last_name].filter(Boolean).join(' ');

  try {
    let text = (m.text || '').trim();
    const cmd = /^\/(\w+)(@\w+)?/.exec(text);
    if (cmd && cmd[1] === 'id') return await sendText(chatId, `Chat ID Anda: ${chatId}\nMasukkan ke TELEGRAM_OWNER_IDS di .env jika Anda pemilik toko.`);
    if (cmd && cmd[1] === 'start') return await sendText(chatId, common.WELCOME);

    if (!text && m.voice) {
      try {
        text = await stt.transcribe({ audioBase64: await downloadFile(m.voice.file_id), mimeType: m.voice.mime_type || 'audio/ogg' });
        await sendText(chatId, `Saya dengar: "${text}"`);
      } catch (e) {
        return await sendText(chatId, 'Maaf, pesan suara belum bisa diproses. Silakan kirim teks.');
      }
    }
    if (!text) return await sendText(chatId, 'Saya baru bisa membaca pesan teks dan pesan suara.');

    call('sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => {});
    const result = await common.processMessage({
      channel: 'telegram', senderId: String(chatId), senderName: name,
      isOwner: owners().includes(String(chatId)), text,
    });
    await sendText(chatId, result.reply);
    if (result.image && owners().includes(String(chatId))) await sendImage(chatId, result.image);
  } catch (e) {
    console.error('Telegram error:', e.message);
    sendText(chatId, 'Maaf, terjadi kendala. Coba lagi sebentar lagi.').catch(() => {});
  }
}

async function pollLoop() {
  let offset = 0;
  try { await call('deleteWebhook', { drop_pending_updates: false }); } catch (e) { console.warn(e.message); }
  for (;;) {
    try {
      const updates = await call('getUpdates', { offset, timeout: 25, allowed_updates: ['message'] });
      for (const u of updates) { offset = u.update_id + 1; handleUpdate(u).catch((e) => console.error(e.message)); }
    } catch (e) {
      console.warn('Telegram polling:', e.message);
      await sleep(5000);
    }
  }
}

// Handler webhook (mode webhook): header rahasia wajib cocok.
function webhook(req, res) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!enabled() || mode() !== 'webhook' || !secret || req.get('x-telegram-bot-api-secret-token') !== secret) return res.sendStatus(403);
  res.sendStatus(200);
  handleUpdate(req.body || {}).catch((e) => console.error(e.message));
}

async function start() {
  if (!enabled()) return;
  common.registerNotifier((text) => Promise.all(owners().map((id) => sendText(id, text))));
  try {
    const me = await call('getMe');
    console.log(`Telegram aktif: @${me.username} (${mode()})`);
  } catch (e) { console.warn('Token Telegram tidak valid:', e.message); return; }
  if (!owners().length) console.warn('TELEGRAM_OWNER_IDS kosong: semua pengguna diperlakukan sebagai pelanggan. Kirim /id ke bot untuk mendapatkan ID Anda.');

  if (mode() === 'webhook') {
    if (!process.env.PUBLIC_BASE_URL || !process.env.TELEGRAM_WEBHOOK_SECRET) {
      console.warn('Mode webhook butuh PUBLIC_BASE_URL dan TELEGRAM_WEBHOOK_SECRET. Telegram tidak dijalankan.');
      return;
    }
    await call('setWebhook', {
      url: `${process.env.PUBLIC_BASE_URL.replace(/\/$/, '')}/webhook/telegram`,
      secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
      allowed_updates: ['message'],
    });
  } else {
    pollLoop();
  }
}

module.exports = { enabled, mode, start, webhook, handleUpdate, sendText };
