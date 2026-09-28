// Laporan penjualan. Semua angka berasal dari order_items sehingga_margin dihitung
// dari unit_cost yang tersimpan saat pesanan dibuat (tidak ikut berubah bila harga modal naik).
const db = require('../db');
const { badRequest } = require('../lib/errors');

const pad = (n) => String(n).padStart(2, '0');

function todayISO(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isoDate(value, field = 'date') {
  const day = String(value || '').trim();
  if (!day) return todayISO();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw badRequest(`${field} harus format YYYY-MM-DD.`);
  const parsed = new Date(`${day}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) throw badRequest(`${field} bukan tanggal yang valid.`);
  return day;
}

function shiftDay(day, delta) {
  const d = new Date(`${day}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return todayISO(d);
}

/** Ringkasan satu hari: omzet, modal, laba, jumlah pesanan, dan produk terlaris. */
async function daily(date) {
  const day = isoDate(date);
  const totals = await db.one(
    `SELECT COUNT(DISTINCT o.id) AS orders,
            COALESCE(SUM(i.qty * i.unit_price), 0) AS revenue,
            COALESCE(SUM(i.qty * i.unit_cost), 0) AS cost,
            COALESCE(SUM(i.qty), 0) AS items_sold
     FROM orders o
     JOIN order_items i ON i.order_id = o.id
     WHERE DATE(o.created_at) = ? AND o.status <> 'cancelled'`, [day]);

  const topProducts = await db.many(
    `SELECT p.id AS product_id, p.name, SUM(i.qty) AS qty,
            SUM(i.qty * i.unit_price) AS revenue, SUM(i.qty * (i.unit_price - i.unit_cost)) AS profit
     FROM orders o
     JOIN order_items i ON i.order_id = o.id
     JOIN products p ON p.id = i.product_id
     WHERE DATE(o.created_at) = ? AND o.status <> 'cancelled'
     GROUP BY p.id, p.name ORDER BY qty DESC, revenue DESC LIMIT 5`, [day]);

  const byStatus = await db.many(
    `SELECT status, COUNT(*) AS count FROM orders
     WHERE DATE(created_at) = ? GROUP BY status`, [day]);

  const revenue = Number(totals.revenue);
  const cost = Number(totals.cost);
  return {
    date: day,
    orders: Number(totals.orders),
    items_sold: Number(totals.items_sold),
    revenue,
    cost,
    profit: Math.round((revenue - cost) * 100) / 100,
    margin_pct: revenue > 0 ? Math.round(((revenue - cost) / revenue) * 1000) / 10 : 0,
    average_order_value: Number(totals.orders) > 0 ? Math.round((revenue / Number(totals.orders)) * 100) / 100 : 0,
    top_products: topProducts,
    orders_by_status: byStatus,
  };
}

/** Deret harian untuk grafik dashboard (default 7 hari terakhir, termasuk hari ini). */
async function trend({ days = 7, endDate = null } = {}) {
  const end = isoDate(endDate);
  const start = shiftDay(end, -(Math.max(Number(days) || 7, 1) - 1));
  const rows = await db.many(
    `SELECT DATE(o.created_at) AS date,
            COUNT(DISTINCT o.id) AS orders,
            COALESCE(SUM(i.qty * i.unit_price), 0) AS revenue,
            COALESCE(SUM(i.qty * i.unit_cost), 0) AS cost
     FROM orders o
     JOIN order_items i ON i.order_id = o.id
     WHERE DATE(o.created_at) BETWEEN ? AND ? AND o.status <> 'cancelled'
     GROUP BY DATE(o.created_at) ORDER BY date ASC`, [start, end]);

  const map = new Map(rows.map((r) => [r.date instanceof Date ? todayISO(r.date) : String(r.date).slice(0, 10), r]));
  const series = [];
  for (let cursor = start; cursor <= end; cursor = shiftDay(cursor, 1)) {
    const row = map.get(cursor);
    const revenue = Number(row ? row.revenue : 0);
    const cost = Number(row ? row.cost : 0);
    series.push({
      date: cursor,
      orders: Number(row ? row.orders : 0),
      revenue,
      cost,
      profit: Math.round((revenue - cost) * 100) / 100,
    });
  }
  return { from: start, to: end, series };
}

/** Laba bulan berjalan + perbandingan dengan bulan sebelumnya. */
async function monthly(date) {
  const day = isoDate(date);
  const month = day.slice(0, 7);
  const totals = await db.one(
    `SELECT COUNT(DISTINCT o.id) AS orders,
            COALESCE(SUM(i.qty * i.unit_price), 0) AS revenue,
            COALESCE(SUM(i.qty * i.unit_cost), 0) AS cost
     FROM orders o JOIN order_items i ON i.order_id = o.id
     WHERE DATE_FORMAT(o.created_at, '%Y-%m') = ? AND o.status <> 'cancelled'`, [month]);
  const revenue = Number(totals.revenue);
  const cost = Number(totals.cost);
  return {
    month,
    orders: Number(totals.orders),
    revenue,
    cost,
    profit: Math.round((revenue - cost) * 100) / 100,
  };
}

module.exports = { daily, trend, monthly, todayISO, isoDate };
