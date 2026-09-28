// Membuat database, tabel, dan (opsional) data contoh: npm run db:init [-- --seed]
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    multipleStatements: true,
  });
  const run = async (file) => conn.query(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  await run('migrations/schema.sql');
  console.log('Skema database siap.');
  if (process.argv.includes('--seed')) {
    await run('seeds/dummyData.sql');
    console.log('Data contoh dimasukkan.');
  }
  await conn.end();
})().catch((e) => { console.error('Gagal:', e.message); process.exit(1); });
