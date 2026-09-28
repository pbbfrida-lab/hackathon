const db = require('../../backend/services/db');

async function list() {
  const [rows] = await db.query('SELECT * FROM products ORDER BY name');
  return rows;
}

async function getById(id) {
  const [rows] = await db.query('SELECT * FROM products WHERE id = ?', [id]);
  return rows[0] || null;
}

// Pencarian nama fleksibel: cocok persis dulu, lalu LIKE dengan nama terpendek.
async function findByName(name, conn = db, forUpdate = false) {
  const term = String(name || '').trim();
  if (!term) return null;
  const suffix = forUpdate ? ' FOR UPDATE' : '';
  const [rows] = await conn.query(
    `SELECT * FROM products WHERE LOWER(name) = LOWER(?) OR LOWER(name) LIKE LOWER(?) ORDER BY (LOWER(name) = LOWER(?)) DESC, CHAR_LENGTH(name) ASC LIMIT 1${suffix}`,
    [term, `%${term}%`, term]
  );
  return rows[0] || null;
}

async function lowStock() {
  const [rows] = await db.query('SELECT * FROM products WHERE stock <= low_stock_threshold ORDER BY stock ASC');
  return rows;
}

async function adjustStock(id, delta) {
  const [result] = await db.query('UPDATE products SET stock = stock + ? WHERE id = ? AND stock + ? >= 0', [delta, id, delta]);
  if (!result.affectedRows) return null;
  return getById(id);
}

module.exports = { list, getById, findByName, lowStock, adjustStock };
