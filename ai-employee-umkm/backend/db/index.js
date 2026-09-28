// Pool MySQL + helper query/transaction. Semua akses database lewat file ini.
const mysql = require('mysql2/promise');
const config = require('../config');
const logger = require('../lib/logger').create('db');

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: config.db.connectionLimit,
  queueLimit: 0,
  charset: 'utf8mb4_unicode_ci',
  decimalNumbers: true,
  enableKeepAlive: true,
});

/** Jalankan query dan kembalikan baris pertama (atau undefined). */
async function one(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows[0];
}

/** Jalankan query dan kembalikan semua baris. */
async function many(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

/** Jalankan INSERT/UPDATE/DELETE dan kembalikan ResultSetHeader. */
async function run(sql, params = []) {
  const [result] = await pool.query(sql, params);
  return result;
}

/**
 * Jalankan `fn` di dalam transaksi. Commit bila sukses, rollback bila error,
 * dan koneksi selalu dikembalikan ke pool.
 */
async function transaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

async function ping() {
  await pool.query('SELECT 1');
  return true;
}

async function close() {
  await pool.end();
}

module.exports = { pool, one, many, run, transaction, ping, close, logger };
