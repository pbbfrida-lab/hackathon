const db = require('../../backend/services/db');
const { httpError } = require('../../backend/middleware/errorHandler');
const customerModel = require('../customers/customerModel');
const productModel = require('../products/productModel');

const STATUSES = ['pending', 'paid', 'processing', 'shipped', 'completed', 'cancelled'];

// items: [{ productId? , productName?, qty }]
async function create({ customerName, phone, items }) {
  if (!Array.isArray(items) || !items.length) throw httpError(400, 'Pesanan harus berisi minimal satu produk.');
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const customer = await customerModel.findOrCreate({ name: customerName, phone }, conn);
    let total = 0;
    const lines = [];

    for (const item of items) {
      const qty = Number(item.qty);
      if (!Number.isInteger(qty) || qty <= 0) throw httpError(400, 'Jumlah (qty) harus bilangan bulat positif.');
      let product;
      if (item.productId) {
        const [rows] = await conn.query('SELECT * FROM products WHERE id = ? FOR UPDATE', [item.productId]);
        product = rows[0];
      } else {
        product = await productModel.findByName(item.productName, conn, true);
      }
      if (!product) throw httpError(404, `Produk tidak ditemukan: ${item.productName || item.productId}`);
      if (product.stock < qty) throw httpError(409, `Stok ${product.name} tidak cukup (tersisa ${product.stock}, diminta ${qty}).`);

      await conn.query('UPDATE products SET stock = stock - ? WHERE id = ?', [qty, product.id]);
      total += product.price * qty;
      lines.push({ product_id: product.id, name: product.name, qty, unit_price: product.price, unit_cost: product.cost });
    }

    const [orderRes] = await conn.query('INSERT INTO orders (customer_id, status, total) VALUES (?, ?, ?)', [customer.id, 'pending', total]);
    for (const l of lines) {
      await conn.query('INSERT INTO order_items (order_id, product_id, qty, unit_price, unit_cost) VALUES (?, ?, ?, ?, ?)',
        [orderRes.insertId, l.product_id, l.qty, l.unit_price, l.unit_cost]);
    }
    await conn.commit();
    return { id: orderRes.insertId, status: 'pending', total, customer: { id: customer.id, name: customer.name }, items: lines };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function getById(id) {
  const [orders] = await db.query(
    `SELECT o.id, o.status, o.total, o.created_at, c.name AS customer_name, c.phone AS customer_phone
     FROM orders o LEFT JOIN customers c ON c.id = o.customer_id WHERE o.id = ?`, [id]);
  if (!orders[0]) return null;
  const [items] = await db.query(
    `SELECT p.name, i.qty, i.unit_price FROM order_items i JOIN products p ON p.id = i.product_id WHERE i.order_id = ?`, [id]);
  return { ...orders[0], items };
}

async function list(limit = 50) {
  const [rows] = await db.query(
    `SELECT o.id, o.status, o.total, o.created_at, c.name AS customer_name
     FROM orders o LEFT JOIN customers c ON c.id = o.customer_id ORDER BY o.id DESC LIMIT ?`, [Number(limit) || 50]);
  return rows;
}

async function updateStatus(id, status) {
  if (!STATUSES.includes(status)) throw httpError(400, `Status harus salah satu dari: ${STATUSES.join(', ')}`);
  const [r] = await db.query('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
  if (!r.affectedRows) return null;
  return getById(id);
}

module.exports = { STATUSES, create, getById, list, updateStatus };
