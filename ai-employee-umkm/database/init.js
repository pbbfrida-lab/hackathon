// Menyiapkan database: buat database, jalankan SEMUA migration berurutan, perbaiki data,
// lalu (opsional) isi data contoh. Pemakaian: npm run db:init [-- --seed]
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mysql = require('mysql2/promise');
const { normalizeCustomerPhones } = require('./repair');

const DB_NAME = process.env.DB_NAME || 'ai_employee_umkm';
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/** Ambil nama file migration yang tersedia, diurutkan berdasarkan angka awalan (001, 002, ...). */
function migrationFiles() {
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => {
      const num = (name) => Number((name.match(/^(\d+)/) || [0, Number.MAX_SAFE_INTEGER])[1]);
      return num(a) - num(b) || a.localeCompare(b);
    });
}

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    multipleStatements: true,
  });

  try {
    for (const file of migrationFiles()) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8').replaceAll('__DB_NAME__', DB_NAME);
      await conn.query(sql);
      console.log(`Migration ${file} selesai.`);
    }

    await conn.query(`USE \`${DB_NAME}\``);
    const fix = await normalizeCustomerPhones(conn);
    console.log(`Data pelanggan: ${fix.scanned} diperiksa, ${fix.fixed} nomor HP dinormalisasi, ${fix.cleared} dikosongkan.`);
    for (const d of fix.dropped) {
      console.log(`  ! #${d.id} ${d.name} (${d.phone}) -> ${d.reason}`);
    }

    if (process.argv.includes('--seed')) {
      const seed = fs.readFileSync(path.join(__dirname, 'seeds/dummyData.sql'), 'utf8').replaceAll('__DB_NAME__', DB_NAME);
      await conn.query(seed);
      console.log('Data contoh dimasukkan.');
    }

    console.log(`Database \`${DB_NAME}\` siap.`);
  } finally {
    await conn.end();
  }
})().catch((e) => { console.error('Gagal:', e.message); process.exit(1); });
