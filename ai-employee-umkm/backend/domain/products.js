// Produk: katalog, stok, dan pencocokan nama produk untuk AI.
// Aturan stok (tidak boleh negatif, tidak boleh kurang dari pesanan) ditegakkan di sini
// supaya controller, tool AI, dan kanal chat memakai satu sumber kebenaran.
const db = require('../db');
const { notFound, conflict, badRequest } = require('../lib/errors');

const SELECT_ALL = 'SELECT * FROM products';

function list({ lowStockOnly = false, search = null } = {}) {
  if (lowStockOnly) {
    return db.many(`${SELECT_ALL} WHERE stock <= low_stock_threshold ORDER BY stock ASC, name ASC`);
  }
  if (search) {
    const term = `%${String(search).trim()}%`;
    return db.many(`${SELECT_ALL} WHERE name LIKE ? ORDER BY name ASC`, [term]);
  }
  return db.many(`${SELECT_ALL} ORDER BY name ASC`);
}

function getById(id) {
  return db.one(`${SELECT_ALL} WHERE id = ?`, [id]);
}

function lowStock() {
  return list({ lowStockOnly: true });
}

function create({ sku, name, description = null, price, cost = 0, stock = 0, lowStockThreshold = 5 }) {
  return db.transaction(async (conn) => {
    const [res] = await conn.query(
      `INSERT INTO products (sku, name, description, price, cost, stock, low_stock_threshold)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [sku, name, description, Number(price) || 0, Number(cost) || 0, Number(stock) || 0, Number(lowStockThreshold) || 0]
    );
    const [rows] = await conn.query(`${SELECT_ALL} WHERE id = ?`, [res.insertId]);
    return rows[0];
  });
}

// ---------------------------------------------------------------------------
// Pencocokan nama produk
//
// Skema lama memakai "cari produk pertama yang salah satu katanya cocok", sehingga
// "stok kopi robusta" bisa dijawab "Kopi Bubuk Tubruk 500g" (cocok di kata "kopi").
// Di sini setiap produk diberi skor: token yang cocok ditimbang panjangnya, dan
// kecocokan yang membuat semua kata kunci terpakai selalu menang.
// ---------------------------------------------------------------------------

const STOPWORDS = new Set(['dan', 'atau', 'yang', 'untuk', 'dengan', 'di', 'ke', 'dari', 'itu', 'ini', 'dong']);

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOPWORDS.has(w));
}

/** Skor 0 = tidak cocok sama sekali. Semakin besar, semakin tepat. */
function scoreProduct(product, query) {
  const name = String(product.name || '').toLowerCase();
  const q = String(query || '').toLowerCase().trim();
  if (!q) return 0;

  if (name === q) return 1000;
  if (name.startsWith(`${q} `) || name.includes(` ${q} `)) return 500; // frasa utuh di dalam nama

  const productTokens = tokenize(product.name);
  const queryTokens = tokenize(query);
  if (!queryTokens.length) return 0;

  let score = 0;
  let matched = 0;
  for (const qt of queryTokens) {
    const exact = productTokens.find((pt) => pt === qt);
    const partial = productTokens.find((pt) => pt.startsWith(qt) || qt.startsWith(pt));
    if (exact) {
      matched += 1;
      score += 10 + exact.length; // kata utuh, makin panjang makin spesifik ("robusta" > "kopi")
    } else if (partial) {
      matched += 1;
      score += 4 + Math.min(partial.length, qt.length);
    }
  }
  if (!matched) return 0;

  // Seluruh kata kunci terpakai = jauh lebih yakin daripada satu kata generik.
  if (matched === queryTokens.length) score += 100;
  // Normalisasi agar nama panjang tidak otomatis menang.
  return score / (1 + productTokens.length * 0.1);
}

/** Produk dengan skor tertinggi, atau null bila tidak ada yang cocok. */
async function findByName(name, { conn = null, forUpdate = false, minScore = 5 } = {}) {
  const exec = conn ? (sql, params) => conn.query(sql, params) : (sql, params) => db.pool.query(sql, params);
  const [rows] = await exec(`${SELECT_ALL} ORDER BY name ASC${forUpdate ? ' FOR UPDATE' : ''}`);
  let best = null;
  let bestScore = 0;
  for (const row of rows) {
    const score = scoreProduct(row, name);
    if (score > bestScore) { best = row; bestScore = score; }
  }
  return bestScore >= minScore ? best : null;
}

/** Najmur kandidat teratas — dipakai agen AI agar bisa menampilkan alternatif. */
async function search(name, limit = 3) {
  const all = await list();
  return all
    .map((p) => ({ product: p, score: scoreProduct(p, name) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.product);
}

// ---------------------------------------------------------------------------
// Stok
// ---------------------------------------------------------------------------

/**
 * Ubah stok sebesar `delta` (positif = barang masuk, negatif = barang keluar).
 * Mengembalikan null bila produk tidak ada atau stok akan negatif.
 */
async function adjustStock(id, delta) {
  const change = Number(delta);
  if (!Number.isInteger(change)) throw badRequest('delta harus bilangan bulat.');
  if (change === 0) throw badRequest('delta tidak boleh nol.');

  const updated = await db.one(
    'UPDATE products SET stock = stock + ? WHERE id = ? AND stock + ? >= 0', [change, id, change]
  );
  if (!updated.affectedRows) {
    const exists = await getById(id);
    if (!exists) throw notFound('Produk tidak ditemukan.');
    throw conflict(`Stok ${exists.name} tidak cukup untuk dikurangi ${Math.abs(change)} (sisa ${exists.stock}).`);
  }
  return getById(id);
}

/** Kurangi stok di dalam transaksi (dipakai saat membuat pesanan). */
async function decrementForOrder(conn, productId, qty) {
  const [rows] = await conn.query(`${SELECT_ALL} WHERE id = ? FOR UPDATE`, [productId]);
  const product = rows[0];
  if (!product) throw notFound(`Produk tidak ditemukan: ${productId}`);
  if (product.stock < qty) {
    throw conflict(`Stok ${product.name} tidak cukup (tersisa ${product.stock}, diminta ${qty}).`);
  }
  await conn.query('UPDATE products SET stock = stock - ? WHERE id = ?', [qty, productId]);
  return product;
}

/** Ringkasan untuk kartu dashboard. */
async function stats() {
  return db.one(`
    SELECT COUNT(*) AS total_products,
           COALESCE(SUM(stock), 0) AS total_stock,
           COALESCE(SUM(CASE WHEN stock <= low_stock_threshold THEN 1 ELSE 0 END), 0) AS low_stock_count
    FROM products
  `);
}

module.exports = {
  list, getById, create, findByName, search, lowStock, adjustStock, decrementForOrder, stats,
  scoreProduct, tokenize,
};
