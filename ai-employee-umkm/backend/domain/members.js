// Member = orang yang mendaftar lewat form publik. Hanya tiga data yang diminta:
// nama, email, dan nomor telepon. Nomor HP memakai normalisasi yang sama dengan
// domain/customers.js supaya pesanan dari chat bisa dihubungkan ke member.
const db = require('../db');
const customers = require('./customers');
const { badRequest, conflict, notFound } = require('../lib/errors');

/** Email disimpan huruf kecil supaya "Andi@Mail.com" dan "andi@mail.com" dianggap sama. */
const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

/** Validasi email yang masuk akal tanpa depends on validator eksternal. */
function isValidEmail(email) {
  if (!email || email.length > 190) return false;
  // Satu "@", tidak boleh-leading/trailing, domain minimal punya satu titik dan TLD >= 2 huruf.
  return /^[^\s@,;:<>()[\]\\]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email);
}

/**
 * Daftarkan member baru.
 * Nama wajib diisi; email dan nomor telepon wajib sama-sama ada karena keduanya
 * dipakai sebagai identitas unik (salah satu boleh sudah terdaftar -> ditolak dengan
 * pesan yang jelas, bukan error database yang membingungkan).
 */
async function register({ name, email, phone }) {
  const cleanName = String(name || '').trim();
  if (cleanName.length < 2) throw badRequest('Nama minimal 2 karakter.');
  if (cleanName.length > 120) throw badRequest('Nama maksimal 120 karakter.');

  const cleanEmail = normalizeEmail(email);
  if (!isValidEmail(cleanEmail)) throw badRequest('Format email tidak valid.');

  const cleanPhone = customers.normalizePhone(phone);
  if (!cleanPhone) throw badRequest('Nomor telepon tidak valid. Contoh: 081234567890');

  const dupe = await db.one(
    'SELECT id, name, email, phone FROM members WHERE email = ? OR phone = ? LIMIT 1',
    [cleanEmail, cleanPhone]
  );
  if (dupe) {
    if (dupe.email === cleanEmail) throw conflict('Email ini sudah terdaftar.');
    throw conflict('Nomor telepon ini sudah terdaftar.');
  }

  const result = await db.run(
    'INSERT INTO members (name, email, phone) VALUES (?, ?, ?)',
    [cleanName, cleanEmail, cleanPhone]
  );
  return getById(result.insertId);
}

function getById(id) {
  return db.one('SELECT * FROM members WHERE id = ?', [Number(id)]);
}

async function findByEmail(email) {
  return db.one('SELECT * FROM members WHERE email = ? LIMIT 1', [normalizeEmail(email)]);
}

async function findByPhone(phone) {
  const clean = customers.normalizePhone(phone);
  if (!clean) return null;
  return db.one('SELECT * FROM members WHERE phone = ? LIMIT 1', [clean]);
}

function list({ limit = 100, status = null, search = '' } = {}) {
  const where = [];
  const params = [];
  if (status) { where.push('status = ?'); params.push(status); }
  if (search) {
    where.push('(name LIKE ? OR email LIKE ? OR phone LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  const sql = `SELECT * FROM members ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT ?`;
  return db.many(sql, [...params, Math.min(Number(limit) || 100, 500)]);
}

async function setStatus(id, status) {
  const member = await getById(id);
  if (!member) throw notFound('Member tidak ditemukan.');
  await db.run('UPDATE members SET status = ? WHERE id = ?', [status, Number(id)]);
  return getById(id);
}

async function remove(id) {
  const result = await db.run('DELETE FROM members WHERE id = ?', [Number(id)]);
  if (!result.affectedRows) throw notFound('Member tidak ditemukan.');
  return { deleted: Number(id) };
}

function count() {
  return db.one('SELECT COUNT(*) total, SUM(status = \'active\') active FROM members');
}

/** Bentuk ringkas untuk ditampilkan di daftar publik. */
function publicView(m) {
  return { name: m.name, email: m.email, phone: customers.displayPhone(m.phone) };
}

module.exports = {
  register, getById, findByEmail, findByPhone, list, setStatus, remove, count,
  normalizeEmail, isValidEmail, publicView,
};
