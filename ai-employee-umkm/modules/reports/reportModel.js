const db = require('../../backend/services/db');

function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Pesanan berstatus 'cancelled' tidak dihitung.
async function daily(date) {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date : todayISO();
  const [[t]] = await db.query(
    `SELECT COUNT(DISTINCT o.id) AS orders,
            COALESCE(SUM(i.qty * i.unit_price), 0) AS revenue,
            COALESCE(SUM(i.qty * i.unit_cost), 0) AS cost
     FROM orders o JOIN order_items i ON i.order_id = o.id
     WHERE DATE(o.created_at) = ? AND o.status <> 'cancelled'`, [day]);
  const [top] = await db.query(
    `SELECT p.name, SUM(i.qty) AS qty, SUM(i.qty * i.unit_price) AS revenue
     FROM orders o JOIN order_items i ON i.order_id = o.id JOIN products p ON p.id = i.product_id
     WHERE DATE(o.created_at) = ? AND o.status <> 'cancelled'
     GROUP BY p.id, p.name ORDER BY qty DESC LIMIT 5`, [day]);
  return {
    date: day,
    orders: Number(t.orders),
    revenue: Number(t.revenue),
    cost: Number(t.cost),
    profit: Number(t.revenue) - Number(t.cost),
    top_products: top,
  };
}

module.exports = { daily, todayISO };
