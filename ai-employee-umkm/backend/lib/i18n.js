// Utilitas bahasa sisi server: normalisasi kode bahasa dan pesan yang dibaca pengguna
// (landing page / live CS), sehingga pengunjung berbahasa Inggris melihat pesan yang sama
// dengan bahasa yang dipilih di antarmuka.
const SUPPORTED = ['id', 'en'];
const DEFAULT_LANG = 'id';
const HEADER = 'x-omnistaff-lang';

const MESSAGES = {
  id: {
    chatRateLimit: 'Batas chat sementara tercapai. Tunggu sebentar atau hubungi kami langsung di WhatsApp.',
    registerRateLimit: 'Terlalu banyak percobaan pendaftaran. Coba lagi beberapa menit lagi.',
    checkoutRateLimit: 'Terlalu banyak percobaan pesanan. Coba lagi beberapa menit lagi.',
    cartEmpty: 'Keranjang masih kosong.',
    maxItemsPerOrder: 'Maksimal {max} jenis produk per pesanan.',
    customerNameRequired: 'Nama pemesan wajib diisi.',
    phoneRequired: 'Nomor telepon wajib diisi.',
    memberWelcome: 'Selamat datang, {name}! Akun member kamu sudah aktif.',
    orderCreated: 'Pesanan #{id} berhasil dibuat.',
  },
  en: {
    chatRateLimit: 'The chat limit has been reached for now. Please wait a moment or contact us directly on WhatsApp.',
    registerRateLimit: 'Too many registration attempts. Please try again in a few minutes.',
    checkoutRateLimit: 'Too many order attempts. Please try again in a few minutes.',
    cartEmpty: 'Your cart is empty.',
    maxItemsPerOrder: 'You can order at most {max} different products per order.',
    customerNameRequired: 'Your name is required.',
    phoneRequired: 'A phone number is required.',
    memberWelcome: "Welcome, {name}! Your member account is now active.",
    orderCreated: 'Order #{id} was created successfully.',
  },
};

function normalizeLang(lang) {
  const base = String(lang || '').trim().toLowerCase().split('-')[0];
  return SUPPORTED.indexOf(base) !== -1 ? base : DEFAULT_LANG;
}

/** Bahasa yang diminta klien: header lebih dulu, lalu field body `lang`. */
function resolveLang(req) {
  const body = (req && req.body) || {};
  return normalizeLang((req && req.get && req.get(HEADER)) || body.lang);
}

function t(lang, key, vars) {
  const table = MESSAGES[normalizeLang(lang)];
  const template = table[key] != null ? table[key] : MESSAGES[DEFAULT_LANG][key];
  if (template == null) return key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) => (vars[name] == null ? match : String(vars[name])));
}

module.exports = { SUPPORTED, DEFAULT_LANG, HEADER, MESSAGES, normalizeLang, resolveLang, t };
