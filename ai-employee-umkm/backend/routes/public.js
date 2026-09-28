// Endpoint PUBLIK untuk landing page: live customer service.
//
// Tidak dikunci APP_API_KEY karena dipakai pengunjung yang belum login. Route ini dipasang
// sebelum auth middleware, jadi aturannya diperketat sebagai gantinya:
//   - peran SELALU 'customer': hanya tool Customer Service, tanpa data keuangan/internal
//   - rate limit per IP untuk melindungi kuota free tier AI
//   - nama pelanggan diambil dari input pengunjung, tidak pernah dari kanal terverifikasi
const express = require('express');
const crypto = require('crypto');
const config = require('../config');
const { asyncHandler, badRequest } = require('../lib/errors');
const { resolveLang, t } = require('../lib/i18n');
const { createLimiter, clientIp } = require('../lib/rateLimit');
const { requireString, requireInt, optionalString } = require('../lib/validate');
const agent = require('../ai/agent');
const sessions = require('../ai/sessions');
const { sanitizeReply } = require('../ai/format');
const products = require('../domain/products');
const orders = require('../domain/orders');
const reports = require('../domain/reports');
const staff = require('../domain/staff');
const members = require('../domain/members');
const paypalPayments = require('../domain/paypalPayments');
const providers = require('../ai/providers');
const paypal = require('../payments/paypal');

const router = express.Router();

const MAX_MESSAGE = 500;
const MAX_NAME = 60;
const MAX_CHECKOUT_ITEMS = 20;

const SUGGESTIONS = {
  id: [
    'Produk apa saja yang tersedia?',
    'Stok kopi robusta masih ada?',
    'Saya mau pesan keripik 3 pcs',
    'Berapa harga sambal terasi?',
  ],
  en: [
    'What products do you have?',
    'Is kopi robusta still in stock?',
    'I want to order 3 banana chips',
    'How much is sambal terasi?',
  ],
};

/** Pesan 429 mengikuti bahasa peminta, jadi tidak ada teks Indonesia yang bocor ke pengunjung EN. */
const localizedMessage = (key) => (req) => t(resolveLang(req), key);

const chatLimiter = createLimiter({
  windowMs: 60_000,
  max: Number(process.env.PUBLIC_CHAT_LIMIT_PER_MINUTE) || 8,
  keyFn: (req) => `landing:${clientIp(req)}`,
  messageFn: localizedMessage('chatRateLimit'),
});

// Registrasi memakai bucket sendiri supaya form yang gagal validasi tidak menghabiskan
// jatah chat, dan supaya spam tidak bisa mengunci chat orang lain.
const registerLimiter = createLimiter({
  windowMs: 10 * 60_000,
  max: Number(process.env.PUBLIC_REGISTER_LIMIT_PER_10MIN) || 5,
  keyFn: (req) => `register:${clientIp(req)}`,
  messageFn: localizedMessage('registerRateLimit'),
});

// Checkout dibatasi lebih ketat karena setiap panggilan mengubah stok.
const checkoutLimiter = createLimiter({
  windowMs: 5 * 60_000,
  max: Number(process.env.PUBLIC_CHECKOUT_LIMIT) || 5,
  keyFn: (req) => `checkout:${clientIp(req)}`,
  messageFn: localizedMessage('checkoutRateLimit'),
});

async function checkoutDetails(body, lang) {
  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (!rawItems.length) throw badRequest(t(lang, 'cartEmpty'));
  if (rawItems.length > MAX_CHECKOUT_ITEMS) {
    throw badRequest(t(lang, 'maxItemsPerOrder', { max: MAX_CHECKOUT_ITEMS }));
  }
  const items = rawItems.map((it) => ({
    productId: requireInt(it.productId !== undefined ? it.productId : it.product_id, 'productId', { min: 1 }),
    qty: requireInt(it.qty !== undefined ? it.qty : it.q, 'qty', { min: 1, max: config.limits.maxCustomerQtyPerProduct }),
  }));
  let name = optionalString(body.name, 'name', { max: 120 });
  let phone = body.phone || body.phone_number || body.no_hp;
  if (body.email) {
    const member = await members.findByEmail(body.email)
      .catch(() => null)
      || await members.register({ name, email: body.email, phone }).catch(() => null);
    if (member) {
      name = member.name;
      phone = member.phone;
    }
  }
  if (!name) throw badRequest(t(lang, 'customerNameRequired'));
  if (!phone) throw badRequest(t(lang, 'phoneRequired'));
  return {
    customerName: name,
    phone,
    items,
    note: optionalString(body.note, 'note', { max: 500 }),
  };
}

/** ID sesi per pengunjung, dibuat di server agar tidak bisa ditebak-menebak oleh klien. */
function sessionIdFor(req) {
  const existing = req.get('x-omnistaff-session');
  if (existing && /^[a-zA-Z0-9_-]{8,64}$/.test(existing)) return existing;
  return `public-${crypto.randomBytes(12).toString('hex')}`;
}

// --- Data untuk bagian katalog di landing page ------------------------------
router.get('/catalog', asyncHandler(async (req, res) => {
  const lang = resolveLang(req);
  const list = await products.list();
  res.json({
    products: list.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      stock_available: p.stock > 0,
    })),
    stats: await reports.daily().then((r) => ({ products: list.length, orders_today: r.orders })),
    staff: staff.list(lang).map((s) => ({ name: s.name, role: s.role, skills: s.skills })),
    ai_live: providers.isLive(),
  });
}));

/** Status singkat supaya badge "AI online" di landing page jujur. */
router.get('/status', (req, res) => {
  res.json({
    ai_live: providers.isLive(),
    ai_provider: providers.activeId(),
    staff_online: staff.list().length,
    busy: staff.list().filter((s) => s.status === 'working').length,
  });
});

// --- Registrasi member (nama, email, no. telepon) -----------------------------
/**
 * Form publik. Setelah berhasil, pengunjung langsung memakai widget live CS supaya
 * bisa langsung pesan. Respons sengaja tidak mengembalikan id database.
 */
router.post('/members', registerLimiter, asyncHandler(async (req, res) => {
  const lang = resolveLang(req);
  const body = req.body || {};
  const member = await members.register({
    name: requireString(body.name, 'nama', { min: 2, max: 120 }),
    email: body.email,
    phone: body.phone || body.phone_number || body.no_hp,
  });
  res.status(201).json({
    ok: true,
    message: t(lang, 'memberWelcome', { name: member.name }),
    member: members.publicView(member),
  });
}));

// --- Checkout keranjang ------------------------------------------------------
/**
 * Pesanan langsung dari form keranjang di landing page (bukan lewat chat AI).
 * Batas qty per produk sama dengan batas pelanggan di ai/tools.js supaya tidak ada
 * jalur untuk memesan dalam jumlah besar tanpa pemilik.
 */
router.post('/checkout', checkoutLimiter, asyncHandler(async (req, res) => {
  const lang = resolveLang(req);
  const details = await checkoutDetails(req.body || {}, lang);
  const order = await orders.create({ ...details, status: 'pending' });

  res.status(201).json({
    ok: true,
    message: t(lang, 'orderCreated', { id: order.id }),
    order: {
      id: order.id,
      status: order.status,
      total: order.total,
      customer: order.customer,
      items: order.items.map((i) => ({ name: i.name, qty: i.qty, unit_price: i.unit_price, subtotal: i.subtotal })),
    },
  });
}));

router.get('/paypal/config', (req, res) => {
  const enabled = paypal.isEnabled();
  res.json({
    enabled,
    clientId: enabled ? config.paypal.clientId : null,
    currency: 'USD',
    idrPerUsd: enabled ? config.paypal.idrPerUsd : null,
  });
});

router.post('/paypal/orders', checkoutLimiter, asyncHandler(async (req, res) => {
  if (!paypal.isEnabled()) throw badRequest('Pembayaran PayPal belum dikonfigurasi.');
  const lang = resolveLang(req);
  const details = await checkoutDetails(req.body || {}, lang);
  const order = await orders.create({ ...details, status: 'pending' });
  try {
    const paypalOrder = await paypal.createOrder({ orderId: order.id, total: order.total });
    if (!paypalOrder.id) throw badRequest('PayPal tidak mengembalikan nomor transaksi.');
    const usdAmount = paypal.toUsd(order.total);
    await paypalPayments.create({ orderId: order.id, paypalOrderId: paypalOrder.id, amount: usdAmount });
    res.status(201).json({ paypalOrderId: paypalOrder.id });
  } catch (error) {
    await orders.updateStatus(order.id, 'cancelled').catch(() => {});
    throw error;
  }
}));

router.post('/paypal/capture', checkoutLimiter, asyncHandler(async (req, res) => {
  const paypalOrderId = requireString((req.body || {}).paypalOrderId, 'paypalOrderId', { max: 64 });
  const payment = await paypalPayments.getByPaypalOrderId(paypalOrderId);
  if (!payment) throw badRequest('Transaksi PayPal tidak ditemukan.');
  if (payment.status === 'cancelled') throw badRequest('Pesanan ini sudah dibatalkan.');

  const localOrder = await orders.getById(payment.order_id);
  if (!localOrder) throw badRequest('Pesanan tidak ditemukan.');
  if (localOrder.status === 'cancelled') throw badRequest('Pesanan ini sudah dibatalkan.');
  const remoteOrder = await paypal.getOrder(paypalOrderId);
  paypal.verifyOrder(remoteOrder, payment);

  let completedOrder = remoteOrder;
  if (remoteOrder.status !== 'COMPLETED') {
    completedOrder = await paypal.captureOrder(paypalOrderId, payment.order_id);
    paypal.verifyOrder(completedOrder, payment);
  }
  const capture = paypal.getCapture(completedOrder);
  if (!capture || !capture.amount || capture.status !== 'COMPLETED'
      || capture.amount.currency_code !== payment.currency
      || Number(capture.amount.value).toFixed(2) !== Number(payment.amount).toFixed(2)) {
    throw badRequest('PayPal belum menyelesaikan pembayaran.');
  }

  if (localOrder.status !== 'paid') await orders.updateStatus(payment.order_id, 'paid');
  if (payment.status !== 'paid') await paypalPayments.markPaid(payment.order_id, capture.id);
  const paidOrder = await orders.getById(payment.order_id);
  res.json({
    order: {
      id: paidOrder.id,
      status: paidOrder.status,
      total: paidOrder.total,
      customer: paidOrder.customer_name,
      items: paidOrder.items.map((item) => ({ ...item, subtotal: item.qty * item.unit_price })),
    },
  });
}));

router.post('/paypal/cancel', checkoutLimiter, asyncHandler(async (req, res) => {
  const paypalOrderId = requireString((req.body || {}).paypalOrderId, 'paypalOrderId', { max: 64 });
  const payment = await paypalPayments.getByPaypalOrderId(paypalOrderId);
  if (!payment) throw badRequest('Transaksi PayPal tidak ditemukan.');
  if (payment.status === 'paid') throw badRequest('Pesanan sudah dibayar dan tidak dapat dibatalkan.');

  const remoteOrder = await paypal.getOrder(paypalOrderId);
  paypal.verifyOrder(remoteOrder, payment, { allowCreated: true });
  if (remoteOrder.status === 'COMPLETED') throw badRequest('Pesanan sudah dibayar dan tidak dapat dibatalkan.');

  const localOrder = await orders.getById(payment.order_id);
  if (localOrder && localOrder.status === 'pending') await orders.updateStatus(payment.order_id, 'cancelled');
  await paypalPayments.markCancelled(payment.order_id);
  res.json({ ok: true });
}));

// --- Live customer service --------------------------------------------------
router.post('/chat', chatLimiter, asyncHandler(async (req, res) => {
  const lang = resolveLang(req);
  const body = req.body || {};
  const message = requireString(body.message, 'message', { max: MAX_MESSAGE });
  const sessionId = sessionIdFor(req);
  const visitorName = optionalString(body.name, 'name', { max: MAX_NAME });

  const result = await agent.handle({
    message,
    history: sessions.get(sessionId),
    role: 'customer', // dikunci: pengunjung tidak pernah mendapat hak staf/internal
    lang,
    context: { channel: 'landing', name: visitorName, verifiedPhone: null, isOwner: false },
  });

  sessions.push(sessionId, 'user', message);
  sessions.push(sessionId, 'assistant', result.reply);

  res.set('x-omnistaff-session', sessionId);
  res.json({
    reply: sanitizeReply(result.reply),
    staff: result.staff,
    agent: result.agent,
    // Pengunjung tidak boleh melihat path file lokal atau daftar aksi internal.
    imageUrl: result.imageUrl,
    order: result.orders && result.orders.length ? result.orders[0] : null,
    mode: result.mode,
  });
}));

router.post('/reset', (req, res) => {
  const sessionId = sessionIdFor(req);
  sessions.clear(sessionId);
  res.set('x-omnistaff-session', sessionId);
  res.json({ ok: true });
});

/** Saran cepat supaya pengunjung bisa langsung klik tanpa mengetik. */
router.get('/suggestions', (req, res) => {
  res.json({ items: SUGGESTIONS[resolveLang(req)] });
});

module.exports = router;
