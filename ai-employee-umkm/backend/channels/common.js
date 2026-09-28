// Logika bersama kanal chat (Telegram, WhatsApp): peran, batas kecepatan, anti-duplikat, notifikasi pemilik.
const orchestrator = require('../../ai/agent/orchestrator');
const sessions = require('../../ai/agent/sessions');

const parseList = (v) => String(v || '').split(',').map((x) => x.trim()).filter(Boolean);
const digits = (v) => String(v || '').replace(/\D/g, '');
const rupiah = (n) => 'Rp' + Number(n || 0).toLocaleString('id-ID');

// --- anti-duplikat (webhook bisa terkirim ulang) ---
const seen = new Set();
function isDuplicate(key) {
  if (seen.has(key)) return true;
  seen.add(key);
  if (seen.size > 2000) seen.delete(seen.values().next().value);
  return false;
}

// --- batas kecepatan: melindungi kuota API AI dari spam ---
const hits = new Map();
function rateLimited(key, max) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < 60000);
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) hits.delete(hits.keys().next().value);
  return arr.length > max;
}

const notifiers = [];
function registerNotifier(fn) { notifiers.push(fn); }
async function notifyOwners(text) {
  await Promise.all(notifiers.map((fn) => Promise.resolve(fn(text)).catch((e) => console.warn('Notifikasi pemilik gagal:', e.message))));
}

// isOwner hanya boleh true jika identitas pengirim sudah terverifikasi oleh kanal.
async function processMessage({ channel, senderId, senderName, verifiedPhone, isOwner, text }) {
  if (rateLimited(`${channel}:${senderId}`, isOwner ? 60 : 12)) {
    return { reply: 'Pesan terlalu cepat. Coba lagi sebentar lagi ya.' };
  }
  const role = isOwner ? 'owner' : 'customer';
  const sessionId = `${channel}:${senderId}`;
  const result = await orchestrator.handle({
    message: String(text).slice(0, 1000),
    history: sessions.get(sessionId),
    role,
    context: { channel, name: senderName, verifiedPhone },
  });
  sessions.push(sessionId, 'user', String(text).slice(0, 1000));
  sessions.push(sessionId, 'assistant', result.reply);

  if (role === 'customer' && result.orders && result.orders.length) {
    const lines = result.orders.map((o) => `Pesanan baru #${o.id} dari ${o.customer || senderName || 'pelanggan'} lewat ${channel}: ${rupiah(o.total)}`);
    notifyOwners(lines.join('\n'));
  }
  return result;
}

const WELCOME = 'Halo! Saya asisten virtual toko. Tanyakan harga & stok produk, buat pesanan (sebutkan nama, produk, dan jumlah), atau cek status pesanan dengan nomor HP pemesan.';

module.exports = { parseList, digits, isDuplicate, processMessage, registerNotifier, notifyOwners, WELCOME };
