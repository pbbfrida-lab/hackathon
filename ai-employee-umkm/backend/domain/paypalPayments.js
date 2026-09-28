const db = require('../db');

function create({ orderId, paypalOrderId, amount }) {
  return db.run(
    `INSERT INTO paypal_payments (order_id, paypal_order_id, amount)
     VALUES (?, ?, ?)`,
    [orderId, paypalOrderId, amount]);
}

function getByPaypalOrderId(paypalOrderId) {
  return db.one('SELECT * FROM paypal_payments WHERE paypal_order_id = ?', [paypalOrderId]);
}

async function markPaid(orderId, captureId) {
  await db.run(
    `UPDATE paypal_payments SET status = 'paid', capture_id = ?
     WHERE order_id = ? AND status <> 'cancelled'`,
    [captureId, orderId]);
}

function markCancelled(orderId) {
  return db.run(
    `UPDATE paypal_payments SET status = 'cancelled'
     WHERE order_id = ? AND status = 'pending'`,
    [orderId]);
}

module.exports = { create, getByPaypalOrderId, markPaid, markCancelled };