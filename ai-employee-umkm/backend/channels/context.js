// Logika bersama kanal chat (Telegram, WhatsApp): peran pengirim, batas kecepatan,
// anti-duplikat pesan, dan notifikasi ke pemilik.
const config = require('../config');
const logger = require('../lib/logger').create('channel');
const agent = require('../ai/agent');
const sessions = require('../ai/sessions');
const customers = require('../domain/customers');

const MAX_MESSAGE = 1000;
const WELCOME = [
  'Halo! Saya asisten virtual toko.',
  '',
  'Saya bisa:',
  '• Cek harga & stok (contoh: "stok kopi robusta")',
  '• Membuat pesanan (contoh: "minta 2 keripik, atas nama Budi")',
  '• Cek status pesanan (contoh: "status pesanan 12")',
  '',
  'Kirim /bantuan untuk daftar perintah.',
].join('\n');

// --- anti-duplikat: webhook sering mengirim ulang pesan yang sama -----------
const seen = new Set();
const SEEN_MAX = 2000;

function isDuplicate(key) {
  const id = String(key);
  if (seen.has(id)) return true;
  seen.add(id);
  if (seen.size > SEEN_MAX) seen.delete(seen.values().next().value);
  return false;
}

// --- batas kecepatan: melindungi kuota API AI dari spam ---------------------
const hits = new Map();

function rateLimited(key, max) {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.delete(hits.keys().next().value);
  return recent.length > max;
}

// --- notifikasi ke pemilik --------------------------------------------------
const notifiers = [];

function registerNotifier(fn) {
  notifiers.push(fn);
}

async function notifyOwners(text) {
  if (!text) return;
  await Promise.all(notifiers.map((fn) => Promise.resolve(fn(text)).catch((e) => logger.warn('notifikasi gagal:', e.message))));
}

const rupiah = (n) => `Rp${Number(n || 0).toLocaleString('id-ID')}`;

/**
 * Proses satu pesan dari kanal mana pun.
 * ctx: { channel, senderId, senderName, verifiedPhone, isOwner, text }
 * Pelanggan hanya dilayani Customer Service; pemilik boleh memanggil semua staf.
 */
async function processMessage({ channel, senderId, senderName, verifiedPhone = null, isOwner = false, text }) {
  const limit = isOwner ? config.limits.ownerMessagesPerMinute : config.limits.customerMessagesPerMinute;
  if (rateLimited(`${channel}:${senderId}`, limit)) {
    return { reply: 'Pesan terlalu cepat. Coba lagi sebentar lagi ya.', throttled: true };
  }

  const sessionId = `${channel}:${senderId}`;
  const message = String(text || '').slice(0, MAX_MESSAGE);
  if (!message.trim()) return { reply: 'Pesan kosong tidak bisa diproses.' };

  // Pengenalan pelanggan supaya pesanannya bisa dicari lewat nomor HP.
  let name = senderName;
  let phone = verifiedPhone;
  if (!isOwner && verifiedPhone) {
    const known = await customers.findByPhone(verifiedPhone).catch(() => null);
    if (known) name = name || known.name;
  }

  const result = await agent.handle({
    message,
    history: sessions.get(sessionId),
    role: isOwner ? 'owner' : 'customer',
    context: { channel, name, verifiedPhone, isOwner },
  });
  sessions.push(sessionId, 'user', message);
  sessions.push(sessionId, 'assistant', result.reply);

  if (!isOwner && result.orders && result.orders.length) {
    const lines = result.orders.map((o) => `Pesanan baru #${o.id} dari ${o.customer || name || 'pelanggan'} lewat ${channel}: ${rupiah(o.total)}`);
    notifyOwners(lines.join('\n'));
  }
  return result;
}

module.exports = {
  WELCOME, isDuplicate, rateLimited, registerNotifier, notifyOwners, processMessage, MAX_MESSAGE,
};
