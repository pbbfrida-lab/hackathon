const config = require('../config');
const { badGateway, badRequest } = require('../lib/errors');

const API_URL = config.paypal.mode === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';
let accessToken = null;
let tokenExpiresAt = 0;

function isEnabled() {
  return Boolean(config.paypal.clientId && config.paypal.clientSecret
    && Number.isFinite(config.paypal.idrPerUsd) && config.paypal.idrPerUsd > 0);
}

function toUsd(idrAmount) {
  if (!isEnabled()) throw badRequest('Pembayaran PayPal belum dikonfigurasi.');
  const amount = Math.round((Number(idrAmount) / config.paypal.idrPerUsd) * 100) / 100;
  if (!Number.isFinite(amount) || amount < 0.01) throw badRequest('Total pesanan terlalu kecil untuk pembayaran PayPal.');
  return amount.toFixed(2);
}

async function request(path, { method = 'GET', body, requestId } = {}) {
  if (!isEnabled()) throw badRequest('Pembayaran PayPal belum dikonfigurasi.');
  if (!accessToken || Date.now() >= tokenExpiresAt) {
    let response;
    try {
      response = await fetch(`${API_URL}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.paypal.clientId}:${config.paypal.clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });
    } catch (error) {
      throw badGateway('PayPal tidak dapat dihubungi. Coba lagi nanti.');
    }
    const token = await response.json().catch(() => ({}));
    if (!response.ok || !token.access_token) throw badGateway('PayPal menolak konfigurasi pembayaran.');
    accessToken = token.access_token;
    tokenExpiresAt = Date.now() + Math.max(0, Number(token.expires_in || 0) - 60) * 1000;
  }

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        ...(requestId ? { 'PayPal-Request-Id': requestId } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    throw badGateway('PayPal tidak dapat dihubungi. Coba lagi nanti.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw badGateway('Transaksi PayPal gagal diproses. Silakan coba lagi.');
  return data;
}

function createOrder({ orderId, total }) {
  return request('/v2/checkout/orders', {
    method: 'POST',
    body: {
      intent: 'CAPTURE',
      purchase_units: [{
        custom_id: String(orderId),
        reference_id: String(orderId),
        amount: { currency_code: 'USD', value: toUsd(total) },
      }],
      application_context: {
        brand_name: 'OmniStaff Store',
        user_action: 'PAY_NOW',
        shipping_preference: 'NO_SHIPPING',
      },
    },
  });
}

function getOrder(orderId) {
  return request(`/v2/checkout/orders/${encodeURIComponent(orderId)}`);
}

function captureOrder(orderId, localOrderId) {
  return request(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: 'POST',
    requestId: `omnistaff-capture-${localOrderId}`.slice(0, 38),
  });
}

function verifyOrder(remoteOrder, payment, { allowCreated = false } = {}) {
  const unit = remoteOrder.purchase_units && remoteOrder.purchase_units[0];
  const amount = unit && unit.amount;
  const expectedAmount = Number(payment.amount).toFixed(2);
  if (!unit || String(unit.custom_id) !== String(payment.order_id)
      || !amount || amount.currency_code !== payment.currency
      || Number(amount.value).toFixed(2) !== expectedAmount) {
    throw badRequest('Rincian pembayaran PayPal tidak cocok dengan pesanan.');
  }
  const allowedStatuses = allowCreated ? ['CREATED', 'APPROVED', 'COMPLETED'] : ['APPROVED', 'COMPLETED'];
  if (!allowedStatuses.includes(remoteOrder.status)) {
    throw badRequest('Pembayaran PayPal belum disetujui.');
  }
  return unit;
}

function getCapture(remoteOrder) {
  return remoteOrder.purchase_units?.[0]?.payments?.captures?.[0] || null;
}

module.exports = { isEnabled, toUsd, createOrder, getOrder, captureOrder, verifyOrder, getCapture };