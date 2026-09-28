// Rute REST untuk dashboard. Kontrak respons sengaja dipertahankan sama dengan versi sebelumnya
// (products, orders, reports/daily, staff) supaya frontend tidak perlu diubah.
const express = require('express');
const { asyncHandler, badRequest, notFound } = require('../lib/errors');
const { resolveLang } = require('../lib/i18n');
const { pagination, requireId, requireInt, requireEnum, isoDate, requireString, optionalString } = require('../lib/validate');
const products = require('../domain/products');
const orders = require('../domain/orders');
const reports = require('../domain/reports');
const customers = require('../domain/customers');
const members = require('../domain/members');
const staff = require('../domain/staff');
const db = require('../db');

const router = express.Router();

// --- Staf virtual -----------------------------------------------------------
router.get('/staff', (req, res) => res.json(staff.list(resolveLang(req))));

// --- Member (registrasi publik: nama, email, no. telepon) --------------------
router.get('/members', asyncHandler(async (req, res) => {
  const { limit } = pagination(req.query, { defaultLimit: 100, maxLimit: 500 });
  const status = optionalString(req.query.status, 'status', { max: 20 });
  const search = optionalString(req.query.search, 'search', { max: 80 }) || '';
  res.json(await members.list({ limit, status, search }));
}));

router.get('/members/stats', asyncHandler(async (req, res) => res.json(await members.count())));

router.get('/members/:id', asyncHandler(async (req, res) => {
  const member = await members.getById(requireId(req.params.id, 'id'));
  if (!member) throw notFound('Member tidak ditemukan.');
  res.json(member);
}));

router.post('/members', asyncHandler(async (req, res) => {
  const body = req.body || {};
  res.status(201).json(await members.register({
    name: requireString(body.name, 'nama', { min: 2, max: 120 }),
    email: body.email,
    phone: body.phone || body.phone_number || body.no_hp,
  }));
}));

router.patch('/members/:id/status', asyncHandler(async (req, res) => {
  const status = requireEnum((req.body || {}).status, 'status', ['active', 'inactive']);
  res.json(await members.setStatus(requireId(req.params.id, 'id'), status));
}));

router.delete('/members/:id', asyncHandler(async (req, res) => {
  res.json(await members.remove(requireId(req.params.id, 'id')));
}));

// --- Produk -----------------------------------------------------------------
router.get('/products', asyncHandler(async (req, res) => {
  const { limit } = pagination(req.query, { defaultLimit: 100, maxLimit: 500 });
  res.json(await products.list({ search: optionalString(req.query.search, 'search', { max: 80 }) }).then((rows) => rows.slice(0, limit)));
}));

router.get('/products/low-stock', asyncHandler(async (req, res) => res.json(await products.lowStock())));

router.post('/products', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const product = await products.create({
    sku: requireString(body.sku, 'sku', { max: 40 }),
    name: requireString(body.name, 'name', { max: 150 }),
    description: optionalString(body.description, 'description', { max: 2000 }),
    price: requireInt(body.price, 'price', { min: 0 }),
    cost: requireInt(body.cost, 'cost', { min: 0 }),
    stock: requireInt(body.stock, 'stock', { min: 0 }),
    lowStockThreshold: body.low_stock_threshold == null ? 5 : requireInt(body.low_stock_threshold, 'low_stock_threshold', { min: 0 }),
  });
  res.status(201).json(product);
}));

router.get('/products/:id', asyncHandler(async (req, res) => {
  const product = await products.getById(requireId(req.params.id));
  if (!product) throw notFound('Produk tidak ditemukan.');
  res.json(product);
}));

router.patch('/products/:id/stock', asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (body.delta === undefined) throw badRequest('Kirim field "delta" (positif = barang masuk, negatif = barang keluar).');
  res.json(await products.adjustStock(requireId(req.params.id), requireInt(body.delta, 'delta')));
}));

// --- Pesanan ----------------------------------------------------------------
router.get('/orders', asyncHandler(async (req, res) => {
  const { limit } = pagination(req.query);
  res.json(await orders.list({
    limit,
    status: req.query.status ? requireEnum(req.query.status, 'status', orders.STATUSES) : null,
    customerId: req.query.customer_id ? requireId(req.query.customer_id, 'customer_id') : null,
  }));
}));

router.post('/orders', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const items = (body.items || []).map((i) => ({
    productId: i.product_id,
    productName: i.product_name,
    qty: i.qty,
  }));
  const order = await orders.create({
    customerName: requireString(body.customer_name, 'customer_name', { max: 120 }),
    phone: optionalString(body.phone, 'phone', { max: 30 }),
    items,
    note: optionalString(body.note, 'note', { max: 500 }),
  });
  res.status(201).json(order);
}));

router.get('/orders/:id', asyncHandler(async (req, res) => {
  const order = await orders.getById(requireId(req.params.id));
  if (!order) throw notFound('Pesanan tidak ditemukan.');
  res.json(order);
}));

router.patch('/orders/:id/status', asyncHandler(async (req, res) => {
  const status = requireString((req.body || {}).status, 'status', { max: 20 });
  res.json(await orders.updateStatus(requireId(req.params.id), status));
}));

// --- Pelanggan --------------------------------------------------------------
router.get('/customers', asyncHandler(async (req, res) => {
  const { limit } = pagination(req.query);
  res.json(await customers.list({ limit }));
}));

// --- Laporan ----------------------------------------------------------------
router.get('/reports/daily', asyncHandler(async (req, res) => {
  res.json(await reports.daily(req.query.date ? isoDate(req.query.date) : undefined));
}));

router.get('/reports/trend', asyncHandler(async (req, res) => {
  const days = requireInt(req.query.days || 7, 'days', { min: 1, max: 90 });
  res.json(await reports.trend({ days, endDate: req.query.date ? isoDate(req.query.date) : null }));
}));

router.get('/reports/monthly', asyncHandler(async (req, res) => {
  res.json(await reports.monthly(req.query.date ? isoDate(req.query.date) : undefined));
}));

// --- Ringkasan dashboard ----------------------------------------------------
router.get('/summary', asyncHandler(async (req, res) => {
  const [today, productStats, pending] = await Promise.all([
    reports.daily(),
    products.stats(),
    db.one("SELECT COUNT(*) AS n FROM orders WHERE status IN ('pending','paid','processing')"),
  ]);
  res.json({
    today,
    products: productStats,
    orders_in_progress: Number(pending.n),
    staff: staff.list(resolveLang(req)),
  });
}));

module.exports = router;
