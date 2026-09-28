const db = require('../../backend/services/db');

// conn opsional: pakai koneksi transaksi jika diberikan.
async function findOrCreate({ name, phone }, conn = db) {
  const cleanName = (name || 'Pelanggan').trim();
  const cleanPhone = phone ? String(phone).replace(/[^\d+]/g, '') : null;
  if (cleanPhone) {
    const [rows] = await conn.query('SELECT * FROM customers WHERE phone = ? LIMIT 1', [cleanPhone]);
    if (rows[0]) return rows[0];
  }
  const [result] = await conn.query('INSERT INTO customers (name, phone) VALUES (?, ?)', [cleanName, cleanPhone]);
  return { id: result.insertId, name: cleanName, phone: cleanPhone };
}

async function list() {
  const [rows] = await db.query('SELECT * FROM customers ORDER BY id DESC LIMIT 100');
  return rows;
}

module.exports = { findOrCreate, list };
