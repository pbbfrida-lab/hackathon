// Pelanggan. Nomor HP dinormalisasi dan jadi kunci identitas supaya pesanannya bisa dicari ulang.
const db = require('../db');

const normalizePhone = (phone) => {
  const raw = String(phone || '').trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  // Simpan dalam format internasional tanpa "+" agar konsisten antar kanal.
  return digits.replace(/^0/, '62');
};

const displayPhone = (phone) => {
  const d = String(phone || '').replace(/\D/g, '');
  if (!d) return null;
  return `+${d}`;
};

/** Cari pelanggan berdasarkan nomor HP; buat baru bila belum ada. `conn` dipakai saat bertransaksi. */
async function findOrCreate({ name, phone }, conn = null) {
  const cleanName = String(name || '').trim() || 'Pelanggan';
  const cleanPhone = normalizePhone(phone);
  const exec = conn
    ? (sql, params) => conn.query(sql, params)
    : (sql, params) => db.pool.query(sql, params);

  if (cleanPhone) {
    const [rows] = await exec('SELECT * FROM customers WHERE phone = ? LIMIT 1', [cleanPhone]);
    if (rows[0]) {
      // Perbarui nama bila pelanggan memberi nama yang lebih lengkap.
      if (cleanName !== 'Pelanggan' && cleanName !== rows[0].name) {
        await exec('UPDATE customers SET name = ? WHERE id = ?', [cleanName, rows[0].id]);
        rows[0].name = cleanName;
      }
      return rows[0];
    }
  }
  const [res] = await exec('INSERT INTO customers (name, phone) VALUES (?, ?)', [cleanName, cleanPhone]);
  return { id: res.insertId, name: cleanName, phone: cleanPhone, created_at: new Date() };
}

function list({ limit = 100 } = {}) {
  return db.many('SELECT * FROM customers ORDER BY id DESC LIMIT ?', [Number(limit) || 100]);
}

/** Cari pelanggan berdasarkan nomor HP saja (dipakai kanal chat untuk mengenali pengirim). */
async function findByPhone(phone) {
  const clean = normalizePhone(phone);
  if (!clean) return null;
  return db.one('SELECT * FROM customers WHERE phone = ? LIMIT 1', [clean]);
}

/** Digit terakhir 9 untuk mencocokkan nomor yang formatnya berbeda (mis. 08xx vs 628xx). */
function samePhone(a, b) {
  const x = String(a || '').replace(/\D/g, '');
  const y = String(b || '').replace(/\D/g, '');
  if (!x || !y) return false;
  return x.slice(-9) === y.slice(-9);
}

module.exports = { normalizePhone, displayPhone, findOrCreate, findByPhone, list, samePhone };
