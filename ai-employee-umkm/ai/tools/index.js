// Kumpulan fungsi yang boleh dipanggil agen AI (function calling).
const productModel = require('../../modules/products/productModel');
const orderModel = require('../../modules/orders/orderModel');
const reportModel = require('../../modules/reports/reportModel');
const imgGenerator = require('../image/imgGenerator');

const fn = (name, description, properties, required = []) => ({
  type: 'function',
  function: { name, description, parameters: { type: 'object', properties, required } },
});

const definitions = {
  check_stock: fn('check_stock', 'Cek harga dan stok satu produk berdasarkan nama.',
    { product_name: { type: 'string', description: 'Nama produk (boleh sebagian)' } }, ['product_name']),
  list_products: fn('list_products', 'Daftar semua produk beserta harga dan stok.', {}),
  create_order: fn('create_order', 'Buat pesanan baru dan kurangi stok.', {
    customer_name: { type: 'string' },
    phone: { type: 'string', description: 'Nomor WhatsApp pelanggan (opsional)' },
    items: { type: 'array', items: { type: 'object', properties: { product_name: { type: 'string' }, qty: { type: 'integer' } }, required: ['product_name', 'qty'] } },
  }, ['customer_name', 'items']),
  get_order_status: fn('get_order_status', 'Cek status dan rincian pesanan. Untuk pelanggan, nomor HP pemesan wajib disebutkan.',
    { order_id: { type: 'integer' }, phone: { type: 'string', description: 'Nomor HP yang dipakai saat memesan' } }, ['order_id']),
  low_stock_report: fn('low_stock_report', 'Daftar produk yang stoknya di bawah batas minimum.', {}),
  update_stock: fn('update_stock', 'Tambah atau kurangi stok produk (delta positif = barang masuk).',
    { product_name: { type: 'string' }, delta: { type: 'integer' } }, ['product_name', 'delta']),
  daily_report: fn('daily_report', 'Ringkasan omzet, modal, laba, dan produk terlaris pada satu hari.',
    { date: { type: 'string', description: 'YYYY-MM-DD, kosongkan untuk hari ini' } }),
  generate_promo_image: fn('generate_promo_image', 'Buat poster promosi untuk sebuah produk.',
    { product_name: { type: 'string' }, headline: { type: 'string' }, style: { type: 'string' } }, ['product_name']),
};

const digits = (v) => String(v || '').replace(/\D/g, '');
const MAX_CUSTOMER_QTY = 20;
const slim = (p) => ({ id: p.id, name: p.name, price: p.price, stock: p.stock, low_stock_threshold: p.low_stock_threshold });

const handlers = {
  async check_stock({ product_name }) {
    const p = await productModel.findByName(product_name);
    return p ? slim(p) : { error: `Produk "${product_name}" tidak ditemukan.` };
  },
  async list_products() {
    return (await productModel.list()).map(slim);
  },
  async create_order({ customer_name, phone, items }, ctx) {
    if (ctx.role === 'customer' && (items || []).some((i) => Number(i.qty) > MAX_CUSTOMER_QTY)) {
      return { error: `Pesanan lewat chat dibatasi maksimal ${MAX_CUSTOMER_QTY} per produk. Hubungi pemilik toko untuk jumlah besar.` };
    }
    return orderModel.create({
      customerName: customer_name || ctx.name,
      phone: ctx.verifiedPhone || phone,
      items: (items || []).map((i) => ({ productName: i.product_name, qty: i.qty })),
    });
  },
  async get_order_status({ order_id, phone }, ctx) {
    const o = await orderModel.getById(order_id);
    if (!o) return { error: `Pesanan #${order_id} tidak ditemukan.` };
    if (ctx.role === 'customer') {
      // Pelanggan hanya boleh melihat pesanannya sendiri: nomor HP harus cocok.
      const given = digits(ctx.verifiedPhone || phone);
      const actual = digits(o.customer_phone);
      if (!given || !actual || given.slice(-9) !== actual.slice(-9)) {
        return { error: 'Untuk melindungi data pelanggan, sebutkan nomor HP yang dipakai saat memesan.' };
      }
      delete o.customer_phone;
    }
    return o;
  },
  async low_stock_report() {
    return (await productModel.lowStock()).map(slim);
  },
  async update_stock({ product_name, delta }) {
    const p = await productModel.findByName(product_name);
    if (!p) return { error: `Produk "${product_name}" tidak ditemukan.` };
    const updated = await productModel.adjustStock(p.id, Number(delta));
    return updated ? slim(updated) : { error: 'Stok tidak boleh menjadi negatif.' };
  },
  async daily_report({ date }) {
    return reportModel.daily(date);
  },
  async generate_promo_image({ product_name, headline, style }) {
    const p = await productModel.findByName(product_name);
    if (!p) return { error: `Produk "${product_name}" tidak ditemukan.` };
    return imgGenerator.generatePromo({ product: p, headline, style });
  },
};

function getDefinitions(names) {
  return names.map((n) => definitions[n]).filter(Boolean);
}

// Error bisnis (stok kurang, dll.) dikembalikan sebagai hasil tool agar AI bisa menjelaskannya.
// ctx: { role: 'owner'|'customer', name, verifiedPhone, channel }
async function execute(name, args, ctx = { role: 'owner' }) {
  if (!handlers[name]) return { error: `Tool tidak dikenal: ${name}` };
  try {
    return await handlers[name](args || {}, ctx);
  } catch (e) {
    if (e.expose) return { error: e.message };
    throw e;
  }
}

module.exports = { getDefinitions, execute };
