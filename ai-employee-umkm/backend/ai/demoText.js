// Balasan mode demo (tanpa LLM) dalam dua bahasa, supaya halaman tetapwaru dan
// tetap bisa dipakai saat tidak ada API key yang terisi.
const { normalizeLang } = require('../lib/i18n');

const TEXT = {
  id: {
    demoNote: '\n\n_(Mode demo: isi API key di .env untuk jawaban AI penuh.)_',
    maybeMeant: ' Mungkin yang Anda maksud: {items}.',
    noAnswer: 'Maaf, saya belum bisa menjawab itu.',
    tooManySteps: 'Permintaan ini butuh terlalu banyak langkah. Coba pecah menjadi permintaan yang lebih kecil.',
    trend: 'Omzet 7 hari terakhir ({from} s.d. {to}): {revenue}, laba {profit}.',
    dailyReport: 'Laporan {date}: {orders} pesanan, omzet {revenue}, modal {cost}, laba {profit}. Terlaris: {top}.',
    promoAsk: 'Produk mana yang ingin dibuatkan posternya? Sebutkan namanya.',
    promoDone: 'Poster untuk {name} sudah dibuat.',
    lowStock: 'Produk hampir habis: {items}.',
    lowStockClear: 'Semua stok aman.',
    stockUpdated: 'Stok {name} sekarang {stock}.',
    orderStatus: 'Pesanan #{id} atas nama {customer} berstatus {status}, total {total}.',
    productList: 'Produk kami:\n{list}',
    productLine: '{name}: {price}.',
    stockLow: ' Stok tinggal {stock}, tersisa sedikit.',
    stockOk: ' Stok tersedia {stock}.',
    similar: 'Produk yang mirip: {items}.',
    help: 'Halo! Saya bisa cek harga & stok, membuat pesanan, mengecek status pesanan, '
      + 'melihat stok yang menipis, membuat laporan penjualan, dan membuat poster promosi.\n'
      + 'Coba: "stok kopi robusta", "minta 2 keripik", atau "laporan hari ini".',
  },

  en: {
    demoNote: '\n\n_(Demo mode: add an API key in .env for full AI answers.)_',
    maybeMeant: ' Perhaps you meant: {items}.',
    noAnswer: "Sorry, I can't answer that yet.",
    tooManySteps: 'This request needs too many steps. Try splitting it into smaller requests.',
    trend: 'Revenue over the last 7 days ({from} to {to}): {revenue}, profit {profit}.',
    dailyReport: 'Report for {date}: {orders} orders, revenue {revenue}, cost of goods {cost}, profit {profit}. Best sellers: {top}.',
    promoAsk: 'Which product should I make a poster for? Please tell me the name.',
    promoDone: 'The poster for {name} is ready.',
    lowStock: 'Running low: {items}.',
    lowStockClear: 'All stock levels are healthy.',
    stockUpdated: '{name} now has {stock} in stock.',
    orderStatus: 'Order #{id} for {customer} is {status}, total {total}.',
    productList: 'Our products:\n{list}',
    productLine: '{name}: {price}.',
    stockLow: ' Only {stock} left, running low.',
    stockOk: ' {stock} in stock.',
    similar: 'Similar products: {items}.',
    help: "Hi! I can check prices and stock, take orders, check order status, review low stock, "
      + 'build sales reports, and design promotional posters.\n'
      + 'Try: "kopi robusta stock", "I want 2 banana chips", or "today\'s report".',
  },
};

function tr(lang, key, vars) {
  const table = TEXT[normalizeLang(lang)];
  const template = table[key] != null ? table[key] : TEXT.id[key];
  if (template == null) return key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) => (vars[name] == null ? match : String(vars[name])));
}

module.exports = { tr };
