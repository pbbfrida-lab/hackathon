// Integrasi Telegram Bot.
//
// Default: long polling (tidak butuh URL publik, cukup token dari @BotFather).
// Mode webhook: set TELEGRAM_MODE=webhook + PUBLIC_BASE_URL (HTTPS) + TELEGRAM_WEBHOOK_SECRET.
//
// Peran:
//   - ID di TELEGRAM_OWNER_IDS  -> pemilik: boleh pakai semua staf (stok, laporan, poster)
//   - ID lainnya                -> pelanggan: hanya Customer Service, data dibatasi
const fs = require('fs');
const config = require('../config');
const logger = require('../lib/logger').create('telegram');
const channel = require('./context');
const agent = require('../ai/agent');
const products = require('../domain/products');
const reports = require('../domain/reports');
const staff = require('../domain/staff');
const voice = require('../ai/voice');
const poster = require('../ai/poster');

const API = () => `https://api.telegram.org/bot${config.telegram.token}`;
const enabled = () => Boolean(config.telegram.token);
const mode = () => config.telegram.mode;
const isOwner = (chatId) => config.telegram.ownerIds.includes(String(chatId));
const rupiah = (n) => `Rp${Number(n || 0).toLocaleString('id-ID')}`;

const HELP = [
  '*OmniStaff AI*',
  '',
  'Perintah:',
  '/start - pesan sambutan',
  '/id - lihat chat ID Anda (pemilik)',
  '/stok - daftar stok menipis',
  '/laporan - laporan penjualan hari ini',
  '/tren - omzet 7 hari terakhir',
  '/produk - daftar produk',
  '/poster \\<nama\\> - buat poster promosi',
  '/status - status staf AI',
  '/bantuan - daftar perintah ini',
  '',
  'Anda juga bisa mengetik bebas, misalnya:',
  '"stok kopi robusta" atau "minta 2 keripik, atas nama Budi".',
].join('\n');

async function call(method, body, form) {
  const res = await fetch(`${API()}/${method}`, form
    ? { method: 'POST', body: form }
    : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) throw new Error(`Telegram ${method}: ${data.description || res.status}`);
  return data.result;
}

function chunks(text, size = 4000) {
  const source = String(text == null ? '' : text);
  if (!source) return ['(kosong)'];
  const out = [];
  for (let i = 0; i < source.length; i += size) out.push(source.slice(i, i + size));
  return out;
}

async function sendText(chatId, text, extra = {}) {
  const parts = chunks(text);
  for (let i = 0; i < parts.length; i += 1) {
    await call('sendMessage', {
      chat_id: chatId,
      text: parts[i],
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      ...(i === 0 ? extra : {}),
    });
  }
}

async function sendChatAction(chatId, action = 'typing') {
  return call('sendChatAction', { chat_id: chatId, action }).catch(() => {});
}

/** Kirim poster. Telegram tidak mendukung SVG, jadi pakai PNG (butuh sharp) atau URL remote. */
async function sendImage(chatId, image) {
  if (!image) return;
  if (image.remoteUrl) return call('sendPhoto', { chat_id: chatId, photo: image.remoteUrl });
  if (image.pngFile) {
    const form = new FormData();
    form.append('chat_id', String(chatId));
    form.append('photo', new Blob([fs.readFileSync(image.pngFile)], { type: 'image/png' }), 'poster.png');
    return call('sendPhoto', null, form);
  }
  const note = image.file
    ? '\n\n_(Poster SVG sudah dibuat di dashboard. Pasang paket `sharp` agar bisa dikirim langsung ke Telegram.)_'
    : '';
  return sendText(chatId, `Poster sudah dibuat dan bisa dilihat di dashboard.${note}`);
}

async function downloadFile(fileId) {
  const info = await call('getFile', { file_id: fileId });
  const res = await fetch(`https://api.telegram.org/file/bot${config.telegram.token}/${info.file_path}`);
  if (!res.ok) throw new Error('gagal mengunduh berkas Telegram');
  return { base64: Buffer.from(await res.arrayBuffer()).toString('base64'), mime: info.mime_type || 'audio/ogg' };
}

// ---------------------------------------------------------------------------
// Perintah
// ---------------------------------------------------------------------------

async function handleCommand(chatId, command, arg) {
  switch (command) {
    case 'start':
    case 'bantuan':
    case 'help':
      await sendText(chatId, HELP);
      return true;

    case 'id':
      await sendText(chatId, `Chat ID Anda: \`${chatId}\`\n`
        + (isOwner(chatId)
          ? 'Anda terdaftar sebagai pemilik toko.'
          : 'Masukkan ID ini ke `TELEGRAM_OWNER_IDS` di .env bila Anda pemilik toko.'));
      return true;

    case 'status': {
      const list = staff.list().map((s) => `${s.status === 'working' ? 'busy' : 'idle'} - ${s.name} (${s.role}): ${s.task}`).join('\n');
      await sendText(chatId, `*Status staf AI*\n${list}\n\nMode AI: ${agent.isLive() ? 'live' : 'demo'}`);
      return true;
    }

    case 'stok': {
      const low = await products.lowStock();
      const body = low.length ? low.map((p) => `• ${p.name} — sisa ${p.stock} (batas ${p.low_stock_threshold})`).join('\n') : 'Semua stok aman.';
      await sendText(chatId, `*Stok menipis*\n${body}`);
      return true;
    }

    case 'produk': {
      const all = await products.list();
      const body = all.map((p) => `• ${p.name} — ${rupiah(p.price)} (stok ${p.stock})`).join('\n');
      await sendText(chatId, `*Produk toko*\n${body}`);
      return true;
    }

    case 'laporan': {
      const r = await reports.daily();
      const top = r.top_products.map((t) => `${t.name} (${t.qty})`).join(', ') || '-';
      await sendText(chatId, `*Laporan ${r.date}*\n`
        + `Pesanan: ${r.orders}\nOmzet: ${rupiah(r.revenue)}\nModal: ${rupiah(r.cost)}\nLaba: ${rupiah(r.profit)}\n`
        + `Terlaris: ${top}`);
      return true;
    }

    case 'tren': {
      const t = await reports.trend({ days: 7 });
      const revenue = t.series.reduce((s, r) => s + r.revenue, 0);
      const profit = t.series.reduce((s, r) => s + r.profit, 0);
      await sendText(chatId, `*7 hari terakhir* (${t.from} s.d. ${t.to})\nOmzet: ${rupiah(revenue)}\nLaba: ${rupiah(profit)}\n\n`
        + t.series.map((r) => `${r.date}: ${rupiah(r.revenue)}`).join('\n'));
      return true;
    }

    case 'poster': {
      if (!isOwner(chatId)) {
        await sendText(chatId, 'Perintah /poster hanya untuk pemilik toko.');
        return true;
      }
      if (!arg) {
        await sendText(chatId, 'Format: /poster nama produk. Contoh: /poster Kopi Robusta Lampung 250g');
        return true;
      }
      await sendChatAction(chatId);
      const found = await products.findByName(arg);
      if (!found) {
        await sendText(chatId, `Produk "${arg}" tidak ditemukan. Coba /produk untuk melihat daftar.`);
        return true;
      }
      const image = await poster.generatePromo({ product: found });
      await sendText(chatId, `Poster untuk *${found.name}* sudah dibuat.`);
      await sendImage(chatId, image);
      return true;
    }

    case 'pesan':
    case 'order': {
      if (!arg) {
        await sendText(chatId, 'Format: /pesan nama produk, jumlah. Contoh: /pesan keripik, 3');
        return true;
      }
      return false; // biarkan agen AI yang membuat pesanan
    }

    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Pesan masuk
// ---------------------------------------------------------------------------

async function handleUpdate(update) {
  const message = update.message || update.edited_message;
  if (!message || !message.chat) return;
  if (message.chat.type !== 'private') return; // hanya chat pribadi
  if (channel.isDuplicate(`tg:${update.update_id}`)) return;

  const chatId = message.chat.id;
  const senderName = [message.from && message.from.first_name, message.from && message.from.last_name]
    .filter(Boolean).join(' ') || null;
  const owner = isOwner(chatId);

  try {
    let text = String(message.text || '').trim();

    // Perintah /xxx@namabot juga dikenali.
    const cmd = /^\/(\w+)(@\w+)?(?:\s+([\s\S]+))?$/.exec(text);
    if (cmd) {
      const handled = await handleCommand(chatId, cmd[1].toLowerCase(), (cmd[3] || '').trim());
      if (handled) return;
      text = (cmd[3] || '').trim(); // /pesan <isi> -> biarkan agen AI yang menangani
      if (!text) {
        await sendText(chatId, HELP);
        return;
      }
    }

    // Pesan suara -> transkripsi (Whisper Groq bila GROQ_API_KEY terisi).
    if (!text && (message.voice || message.audio)) {
      try {
        const media = await downloadFile((message.voice || message.audio).file_id);
        const result = await voice.transcribe({ audioBase64: media.base64, mimeType: media.mime });
        text = result.text;
        await sendText(chatId, `Saya dengar: _${text}_`);
      } catch (err) {
        logger.warn('transkripsi suara gagal:', err.message);
        return sendText(chatId, 'Maaf, pesan suara belum bisa diproses. Silakan kirim teks.');
      }
    }
    if (!text) return sendText(chatId, 'Saya baru bisa membaca pesan teks dan pesan suara.');

    await sendChatAction(chatId);
    const result = await channel.processMessage({
      channel: 'telegram',
      senderId: String(chatId),
      senderName,
      verifiedPhone: null,
      isOwner: owner,
      text,
    });

    await sendText(chatId, result.reply);
    if (owner && result.image) await sendImage(chatId, result.image);
  } catch (err) {
    logger.error('gagal menangani pesan Telegram:', err);
    sendText(chatId, 'Maaf, terjadi kendala. Coba lagi sebentar lagi.').catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

let pollOffset = 0;
let polling = false;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pollLoop() {
  polling = true;
  try {
    await call('deleteWebhook', { drop_pending_updates: false });
  } catch (err) {
    logger.warn('tidak bisa menghapus webhook lama:', err.message);
  }
  while (polling) {
    try {
      const updates = await call('getUpdates', {
        offset: pollOffset,
        timeout: config.telegram.pollTimeoutSec,
        allowed_updates: ['message', 'edited_message'],
      });
      for (const update of updates) {
        pollOffset = update.update_id + 1;
        handleUpdate(update).catch((err) => logger.error(err.message));
      }
    } catch (err) {
      logger.warn('polling Telegram bermasalah:', err.message);
      await sleep(5000);
    }
  }
}

function webhook(req, res) {
  const secret = config.telegram.webhookSecret;
  if (!enabled() || mode() !== 'webhook' || !secret) return res.sendStatus(403);
  if (req.get('x-telegram-bot-api-secret-token') !== secret) return res.sendStatus(403);
  res.sendStatus(200);
  handleUpdate(req.body || {}).catch((err) => logger.error(err.message));
}

async function start() {
  if (!enabled()) {
    logger.info('Telegram nonaktif (TELEGRAM_BOT_TOKEN kosong).');
    return;
  }
  channel.registerNotifier((text) => Promise.all(config.telegram.ownerIds.map((id) => sendText(id, text))));

  let me;
  try {
    me = await call('getMe');
  } catch (err) {
    logger.error('token Telegram tidak valid:', err.message);
    return;
  }
  logger.info(`Telegram aktif: @${me.username} (mode ${mode()})`);

  if (!config.telegram.ownerIds.length) {
    logger.warn('TELEGRAM_OWNER_IDS kosong: semua pengguna diperlakukan sebagai pelanggan. '
      + `Kirim /id ke @${me.username} untuk melihat ID Anda.`);
  }

  if (mode() === 'webhook') {
    if (!config.publicBaseUrl || !config.telegram.webhookSecret) {
      logger.error('mode webhook butuh PUBLIC_BASE_URL dan TELEGRAM_WEBHOOK_SECRET. Telegram tidak dijalankan.');
      return;
    }
    try {
      await call('setWebhook', {
        url: `${config.publicBaseUrl}/webhook/telegram`,
        secret_token: config.telegram.webhookSecret,
        allowed_updates: ['message', 'edited_message'],
      });
      logger.info(`Webhook daftarkan di ${config.publicBaseUrl}/webhook/telegram`);
    } catch (err) {
      logger.error('gagal mendaftarkan webhook:', err.message);
    }
  } else {
    pollLoop().catch((err) => logger.error('pollLoop berhenti:', err.message));
  }
}

function stop() {
  polling = false;
}

function status() {
  if (!enabled()) return 'off';
  return mode();
}

module.exports = { enabled, mode, status, start, stop, webhook, handleUpdate, sendText, handleCommand, HELP, isOwner };
