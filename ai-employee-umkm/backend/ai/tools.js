// Fungsi yang boleh dipanggil agen AI (function calling).
// Setiap tool mengembalikan objek biasa; error bisnis dikembalikan sebagai { error } supaya
// AI bisa menjelaskannya ke pengguna, bukan melempar 500.
const config = require('../config');
const logger = require('../lib/logger').create('tools');
const products = require('../domain/products');
const orders = require('../domain/orders');
const reports = require('../domain/reports');
const customers = require('../domain/customers');
const poster = require('./poster');

const definition = (name, description, properties, required = []) => ({
  type: 'function',
  function: { name, description, parameters: { type: 'object', properties, required } },
});

const DEFINITIONS = {
  check_stock: definition('check_stock', 'Cek harga dan stok satu produk berdasarkan nama. Gunakan saat pelanggan menanyakan ketersediaan atau harga.',
    { product_name: { type: 'string', description: 'Nama produk, boleh sebagian (mis. "kopi robusta")' } }, ['product_name']),

  list_products: definition('list_products', 'Daftar semua produk lengkap dengan harga, stok, dan batas minimum stok.', {}),

  search_products: definition('search_products', 'Cari produk yang namanya mirip dengan kata kunci, untuk mirip-mirip atau typo.',
    { query: { type: 'string' }, limit: { type: 'integer', description: 'Jumlah hasil (default 3)' } }, ['query']),

  create_order: definition('create_order', 'Buat pesanan baru dan kurangi stok. Panggil hanya setelah nama pelanggan, produk, dan jumlah sudah jelas.',
    {
      customer_name: { type: 'string', description: 'Nama pelanggan' },
      phone: { type: 'string', description: 'Nomor WhatsApp pelanggan (opsional)' },
      items: {
        type: 'array',
        description: 'Daftar produk yang dipesan',
        items: {
          type: 'object',
          properties: {
            product_name: { type: 'string' },
            qty: { type: 'integer', description: 'Jumlah bilangan bulat positif' },
          },
          required: ['product_name', 'qty'],
        },
      },
    }, ['customer_name', 'items']),

  get_order_status: definition('get_order_status', 'Cek status dan rincian pesanan. Untuk pelanggan, nomor HP yang dipakai saat memesan wajib disebutkan.',
    {
      order_id: { type: 'integer', description: 'Nomor pesanan' },
      phone: { type: 'string', description: 'Nomor HP yang dipakai saat memesan' },
    }, ['order_id']),

  low_stock_report: definition('low_stock_report', 'Daftar produk yang stoknya sudah menyentuh batas minimum.', {}),

  update_stock: definition('update_stock', 'Tambah atau kurangi stok produk._delta_ positif berarti barang masuk, negatif berarti barang keluar.',
    { product_name: { type: 'string' }, delta: { type: 'integer' } }, ['product_name', 'delta']),

  daily_report: definition('daily_report', 'Ringkasan omzet, modal, laba, dan produk terlaris untuk satu hari.',
    { date: { type: 'string', description: 'Format YYYY-MM-DD, kosongkan untuk hari ini' } }),

  sales_trend: definition('sales_trend', 'Tren penjualan beberapa hari terakhir (omzet dan laba per hari).',
    { days: { type: 'integer', description: 'Jumlah hari, default 7' } }),

  generate_promo_image: definition('generate_promo_image', 'Buat poster promosi untuk sebuah produk.',
    { product_name: { type: 'string' }, headline: { type: 'string', description: 'Kalimat singkat yang menonjolkan produk' }, style: { type: 'string' } }, ['product_name']),
};

const slim = (p) => ({
  id: p.id,
  name: p.name,
  price: p.price,
  stock: p.stock,
  low_stock_threshold: p.low_stock_threshold,
  low_stock: p.stock <= p.low_stock_threshold,
});

const HANDLERS = {
  async check_stock({ product_name }) {
    const found = await products.findByName(product_name);
    if (!found) {
      const alternatives = await products.search(product_name, 3);
      return {
        error: `Produk "${product_name}" tidak ditemukan.`,
        suggestions: alternatives.map(slim),
        hint: 'Kalau tidak yakin, panggil search_products untuk mencari nama yang mirip.',
      };
    }
    return slim(found);
  },

  async list_products() {
    return (await products.list()).map(slim);
  },

  async search_products({ query, limit }) {
    const found = await products.search(query, Math.min(Number(limit) || 3, 5));
    return found.length ? found.map(slim) : { error: `Tidak ada produk yang mirip "${query}".`, suggestions: [] };
  },

  async create_order({ customer_name, phone, items }, ctx) {
    const cleanItems = (items || []).filter((i) => i && (i.product_name || i.productName));
    if (!cleanItems.length) return { error: 'Pesanan harus berisi minimal satu produk beserta jumlahnya.' };

    // Pelanggan chat dibatasi supaya tidak bisa memesan dalam jumlah besar tanpa pemilik.
    if (ctx.role === 'customer') {
      const tooMany = cleanItems.find((i) => Number(i.qty) > config.limits.maxCustomerQtyPerProduct);
      if (tooMany) {
        return {
          error: `Pesanan lewat chat dibatasi maksimal ${config.limits.maxCustomerQtyPerProduct} per produk. `
            + 'Untuk jumlah besar, minta pelanggan menghubungi pemilik toko.',
        };
      }
    }

    const name = customer_name || ctx.name;
    if (!name) return { error: 'Nama pelanggan belum diketahui. Tolong minta nama pembeli lebih dulu.' };

    return orders.create({
      customerName: name,
      phone: ctx.verifiedPhone || phone,
      items: cleanItems.map((i) => ({ productName: i.product_name || i.productName, qty: Number(i.qty) })),
    });
  },

  async get_order_status({ order_id, phone }, ctx) {
    const order = await orders.getById(Number(order_id));
    if (!order) return { error: `Pesanan #${order_id} tidak ditemukan.` };

    if (ctx.role === 'customer') {
      // Pelanggan hanya boleh melihat pesanannya sendiri: nomor HP harus cocok.
      const given = ctx.verifiedPhone || phone;
      if (!given || !order.customer_phone || !customers.samePhone(given, order.customer_phone)) {
        return {
          error: 'Untuk melindungi data pelanggan, sebutkan nomor HP yang dipakai saat memesan.',
          order_id: order.id,
        };
      }
      delete order.customer_phone;
    }
    return order;
  },

  async low_stock_report() {
    return (await products.lowStock()).map(slim);
  },

  async update_stock({ product_name, delta }) {
    const found = await products.findByName(product_name);
    if (!found) return { error: `Produk "${product_name}" tidak ditemukan.` };
    const amount = Number(delta);
    if (!Number.isInteger(amount) || amount === 0) return { error: 'delta harus bilangan bulat bukan nol.' };
    return slim(await products.adjustStock(found.id, amount));
  },

  async daily_report({ date }) {
    return reports.daily(date);
  },

  async sales_trend({ days }) {
    return reports.trend({ days: Math.min(Number(days) || 7, 31) });
  },

  async generate_promo_image({ product_name, headline, style }) {
    const found = await products.findByName(product_name);
    if (!found) {
      const alternatives = await products.search(product_name, 3);
      return { error: `Produk "${product_name}" tidak ditemukan.`, suggestions: alternatives.map(slim) };
    }
    return poster.generatePromo({ product: found, headline, style });
  },
};

/** Definisi tool sesuai daftar nama yang diminta agen. */
function getDefinitions(names) {
  return (names || []).map((n) => DEFINITIONS[n]).filter(Boolean);
}

/**
 * Jalankan tool.
 * ctx: { role: 'owner' | 'customer', name, verifiedPhone, channel }
 */
async function execute(name, args = {}, ctx = { role: 'owner' }) {
  const handler = HANDLERS[name];
  if (!handler) return { error: `Tool "${name}" tidak dikenal.` };
  try {
    return await handler(args, ctx);
  } catch (err) {
    if (err.expose) return { error: err.message };
    logger.error(`tool ${name} gagal:`, err);
    return { error: `Gagal menjalankan ${name}: ${err.message}` };
  }
}

module.exports = { DEFINITIONS, HANDLERS, getDefinitions, execute };
