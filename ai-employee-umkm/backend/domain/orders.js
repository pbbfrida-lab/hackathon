// Pesanan. Pembuatan pesanan selalu transaksional dan mengunci baris produk
// (SELECT ... FOR UPDATE) agar stok tidak bisa terjual ganda saat ada dua pembeli bersamaan.
const db = require('../db');
const { badRequest, notFound, conflict } = require('../lib/errors');
const products = require('./products');
const customers = require('./customers');

const STATUSES = ['pending', 'paid', 'processing', 'shipped', 'completed', 'cancelled'];
const ACTIVE_STATUSES = STATUSES.filter((s) => s !== 'cancelled');
const MAX_ITEMS = 50;
const MAX_QTY_PER_ITEM = 999;

async function getById(id) {
  const order = await db.one(
    `SELECT o.id, o.status, o.total, o.created_at, c.name AS customer_name, c.phone AS customer_phone
     FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
     WHERE o.id = ?`, [id]);
  if (!order) return null;
  order.items = await db.many(
    `SELECT p.id AS product_id, p.name, i.qty, i.unit_price, i.unit_cost, (i.qty * i.unit_price) AS subtotal
     FROM order_items i JOIN products p ON p.id = i.product_id
     WHERE i.order_id = ? ORDER BY i.id`, [id]);
  return order;
}

function list({ limit = 50, status = null, customerId = null } = {}) {
  const where = [];
  const params = [];
  if (status) { where.push('o.status = ?'); params.push(status); }
  if (customerId) { where.push('o.customer_id = ?'); params.push(customerId); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return db.many(
    `SELECT o.id, o.status, o.total, o.created_at, c.name AS customer_name
     FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
     ${clause} ORDER BY o.id DESC LIMIT ?`, [...params, Number(limit) || 50]);
}

/**
 * Buat pesanan baru. Item boleh diisi dengan `productId` (dari frontend) atau
 * `productName` (dari AI/katalog pelanggan) — nama diselesaikan lewat pencarian skored.
 */
async function create({ customerName, phone, items, status = 'pending', note = null }) {
  if (!Array.isArray(items) || !items.length) throw badRequest('Pesanan harus berisi minimal satu produk.');
  if (items.length > MAX_ITEMS) throw badRequest(`Maksimal ${MAX_ITEMS} jenis produk per pesanan.`);

  return db.transaction(async (conn) => {
    const customer = await customers.findOrCreate({ name: customerName, phone }, conn);
    const lines = [];
    let total = 0;

    for (const item of items) {
      const qty = Number(item.qty);
      if (!Number.isInteger(qty) || qty <= 0) throw badRequest('Jumlah (qty) harus bilangan bulat positif.');
      if (qty > MAX_QTY_PER_ITEM) throw badRequest(`Jumlah per produk maksimal ${MAX_QTY_PER_ITEM}.`);

      let product = null;
      if (item.productId) {
        product = await products.decrementForOrder(conn, Number(item.productId), qty);
      } else {
        const found = await products.findByName(item.productName, { conn, forUpdate: true });
        if (!found) throw notFound(`Produk tidak ditemukan: ${item.productName}`);
        product = await products.decrementForOrder(conn, found.id, qty);
      }

      total += product.price * qty;
      lines.push({
        product_id: product.id,
        name: product.name,
        qty,
        unit_price: product.price,
        unit_cost: product.cost,
        subtotal: product.price * qty,
      });
    }

    total = Math.round(total * 100) / 100;
    const [orderRes] = await conn.query(
      'INSERT INTO orders (customer_id, status, total) VALUES (?, ?, ?)', [customer.id, status, total]);
    for (const line of lines) {
      await conn.query(
        'INSERT INTO order_items (order_id, product_id, qty, unit_price, unit_cost) VALUES (?, ?, ?, ?, ?)',
        [orderRes.insertId, line.product_id, line.qty, line.unit_price, line.unit_cost]);
    }
    if (note) {
      await conn.query('INSERT INTO order_notes (order_id, note) VALUES (?, ?)', [orderRes.insertId, String(note).slice(0, 500)]);
    }

    return {
      id: orderRes.insertId,
      status,
      total,
      note,
      customer: { id: customer.id, name: customer.name, phone: customers.displayPhone(customer.phone) },
      items: lines,
    };
  });
}

async function updateStatus(id, status) {
  if (!STATUSES.includes(status)) throw badRequest(`Status harus salah satu dari: ${STATUSES.join(', ')}`);
  const current = await db.one('SELECT * FROM orders WHERE id = ?', [id]);
  if (!current) throw notFound('Pesanan tidak ditemukan.');

  // Batalkan pesanan -> stok produk dikembalikan.
  if (status === 'cancelled' && current.status !== 'cancelled') {
    await db.transaction(async (conn) => {
      const items = await conn.query('SELECT product_id, qty FROM order_items WHERE order_id = ?', [id]);
      for (const [row] of items) {
        await conn.query('UPDATE products SET stock = stock + ? WHERE id = ?', [row.qty, row.product_id]);
      }
      await conn.query('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
    });
  } else {
    const res = await db.run('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
    if (!res.affectedRows) throw notFound('Pesanan tidak ditemukan.');
  }
  return getById(id);
}

module.exports = { STATUSES, ACTIVE_STATUSES, MAX_QTY_PER_ITEM, getById, list, create, updateStatus };
