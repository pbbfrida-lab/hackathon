// Perbaikan data yang tidak bisa dikerjakan oleh CREATE TABLE.
// Dipanggil otomatis oleh database/init.js dan bisa dijalankan sendiri: npm run db:repair
//
// Bug yang diperbaiki: data lama menyimpan nomor HP format lokal ("081234567001"),
// sedangkan backend/domain/customers.js menormalisasi ke format internasional ("6281234567001").
// Akibatnya findByPhone()/findOrCreate() tidak pernah menemukan pelanggan lama saat chat.
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mysql = require('mysql2/promise');
const { normalizePhone } = require('../backend/domain/customers');

/**
 * Samakan format nomor HP semua pelanggan ke format internasional.
 * Jika dua pelanggan berakhir pada nomor yang sama, pelanggan tertua tetap memegang nomor
 * dan pelanggan lain dikosongkan (nama & pesanannya tetap aman) agar unique index tidak bentrok.
 */
async function normalizeCustomerPhones(conn) {
  const [rows] = await conn.query('SELECT id, name, phone FROM customers WHERE phone IS NOT NULL AND phone <> ""');
  const owner = new Map();
  const updates = [];
  const dropped = [];

  for (const row of rows) {
    const next = normalizePhone(row.phone);
    if (!next || next === row.phone) {
      // Tidak bisa dinormalisasi (terlalu pendek/panjang) -> biarkan, tidak boleh menebak.
      if (!next) dropped.push({ id: row.id, name: row.name, phone: row.phone, reason: 'format tidak dikenali' });
      continue;
    }
    if (owner.has(next)) {
      dropped.push({ id: row.id, name: row.name, phone: row.phone, reason: `duplikat dari pelanggan #${owner.get(next)}` });
      continue;
    }
    owner.set(next, row.id);
    updates.push({ id: row.id, phone: next });
  }

  // Kosongkan nomor yang bentrok/duplikat lebih dulu supaya update utama tidak
  // menabrak UNIQUE KEY di tengah proses.
  for (const d of dropped) {
    await conn.query('UPDATE customers SET phone = NULL WHERE id = ?', [d.id]);
  }
  for (const u of updates) {
    await conn.query('UPDATE customers SET phone = ? WHERE id = ?', [u.phone, u.id]);
  }

  return { scanned: rows.length, fixed: updates.length, cleared: dropped.length, dropped };
}

/** Daftar tabel yang aktif, dipakai sebagai ringkasan hasil perbaikan. */
async function reportTables(conn) {
  const [rows] = await conn.query('SHOW TABLES');
  return rows.map((r) => Object.values(r)[0]);
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'ai_employee_umkm',
  });

  try {
    const result = await normalizeCustomerPhones(conn);
    console.log(`Nomor HP diperiksa: ${result.scanned} baris.`);
    console.log(`  dinormalisasi : ${result.fixed}`);
    console.log(`  dikosongkan  : ${result.cleared}`);
    for (const d of result.dropped) {
      console.log(`  ! pelanggan #${d.id} (${d.name}) nomor ${d.phone} -> ${d.reason}`);
    }
    const tables = await reportTables(conn);
    console.log(`Tabel aktif: ${tables.join(', ')}`);
  } finally {
    await conn.end();
  }
}

if (require.main === module) {
  main().catch((e) => { console.error('Gagal memperbaiki database:', e.message); process.exit(1); });
}

module.exports = { normalizeCustomerPhones };
