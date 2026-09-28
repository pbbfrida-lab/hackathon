// npm run doctor — memeriksa konfigurasi, database, dan tiap API key AI.
// Jalankan setelah mengisi .env untuk memastikan semua kredensial benar.
//
//   node scripts/doctor.js            periksa semuanya
//   node scripts/doctor.js --ai       hanya API key AI
//   node scripts/doctor.js --db       hanya database
//   node scripts/doctor.js --channels hanya Telegram/WhatsApp
const config = require('../backend/config');
const db = require('../backend/db');
const providers = require('../backend/ai/providers');
const telegram = require('../backend/channels/telegram');
const whatsapp = require('../backend/channels/whatsapp');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

const ok = (m) => console.log(`  ${GREEN}OK${RESET}    ${m}`);
const fail = (m) => console.log(`  ${RED}GAGAL${RESET} ${m}`);
const warn = (m) => console.log(`  ${YELLOW}CATAT${RESET} ${m}`);
const info = (m) => console.log(`  ${DIM}info${RESET}  ${m}`);
const head = (m) => console.log(`\n${BOLD}${m}${RESET}`);

const args = process.argv.slice(2);
const only = (flag) => args.length === 0 || args.includes(flag);

async function checkDatabase() {
  head('Database');
  try {
    await db.ping();
    ok(`terhubung ke ${config.db.user}@${config.db.host}:${config.db.port}/${config.db.database}`);
  } catch (err) {
    fail(`tidak terhubung: ${err.message}`);
    warn('perbaiki DB_* di .env, lalu jalankan: npm run db:init -- --seed');
    return false;
  }
  const tables = await db.many('SHOW TABLES').catch(() => []);
  const names = tables.map((t) => Object.values(t)[0]);
  const required = ['products', 'orders', 'order_items', 'customers', 'staff_activity'];
  const missing = required.filter((t) => !names.includes(t));
  if (missing.length) {
    fail(`tabel belum ada: ${missing.join(', ')}`);
    warn('jalankan: npm run db:init -- --seed');
    return false;
  }
  ok(`semua tabel ada (${names.length} tabel)`);

  const [products, orders, customers] = await Promise.all([
    db.one('SELECT COUNT(*) AS n FROM products'),
    db.one('SELECT COUNT(*) AS n FROM orders'),
    db.one('SELECT COUNT(*) AS n FROM customers'),
  ]);
  info(`isi database: ${products.n} produk, ${orders.n} pesanan, ${customers.n} pelanggan`);
  if (!products.n) warn('belum ada produk — AI akan menjawab "produk tidak ditemukan"');
  return true;
}

async function checkAi() {
  head('Provider AI');
  const list = providers.status();
  if (!list.some((p) => p.configured)) {
    warn('tidak ada API key yang terisi — aplikasi berjalan dalam MODE DEMO (jawaban berbasis aturan)');
    info('cara mengaktifkan AI live:');
    info('  Groq           -> https://console.groq.com/keys            -> GROQ_API_KEY');
    info('  Google AI Studio-> https://aistudio.google.com/apikey      -> GEMINI_API_KEY');
    info('  Freebuff       -> jalankan adapter lalu isi FREEBUFF_BASE_URL/FREEBUFF_API_KEY');
    return false;
  }

  const results = await providers.checkAll();
  let live = 0;
  for (const r of results) {
    const label = r.id.padEnd(9);
    if (!providers.status().find((p) => p.id === r.id).configured) {
      info(`${label} belum dikonfigurasi (dilewati)`);
      continue;
    }
    if (r.ok) {
      live += 1;
      ok(`${label} ${r.detail} (${r.ms}ms)`);
    } else {
      fail(`${label} ${r.detail}`);
      if (r.hint) info(`          cara memperoleh key: ${r.hint}`);
    }
  }
  console.log('');
  if (live > 0) {
    ok(`${live} provider siap. Provider berikutnya dipakai otomatis bila yang pertama gagal/rate-limit.`);
  } else {
    fail('tidak ada provider yang bisa dipakai');
  }
  return live > 0;
}

async function checkChannels() {
  head('Kanal chat');
  if (telegram.enabled()) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${config.telegram.token}/getMe`);
      const data = await res.json();
      if (data.ok) {
        ok(`Telegram @${data.result.username} (mode ${telegram.mode()})`);
        if (telegram.mode() === 'webhook') {
          if (!config.publicBaseUrl) fail('mode webhook butuh PUBLIC_BASE_URL (HTTPS)');
          if (!config.telegram.webhookSecret) fail('mode webhook butuh TELEGRAM_WEBHOOK_SECRET');
        }
        if (!config.telegram.ownerIds.length) {
          warn('TELEGRAM_OWNER_IDS kosong: semua pengguna jadi pelanggan. Kirim /id ke bot untuk mendapat ID Anda.');
        } else {
          ok(`pemilik terdaftar: ${config.telegram.ownerIds.join(', ')}`);
        }
      } else {
        fail(`token Telegram ditolak: ${data.description}`);
      }
    } catch (err) {
      fail(`tidak bisa menghubungi Telegram: ${err.message}`);
    }
  } else {
    warn('Telegram nonaktif (TELEGRAM_BOT_TOKEN kosong) — cara termudah menyalakan kanal chat');
    info('  1. Chat @BotFather -> /newbot -> salin token ke TELEGRAM_BOT_TOKEN');
    info('  2. npm start, lalu kirim /start ke bot-mu');
    info('  3. Kirim /id ke bot, masukkan ID-nya ke TELEGRAM_OWNER_IDS');
  }

  if (whatsapp.enabled()) {
    ok('WhatsApp Cloud API aktif (menunggu webhook)');
    if (!config.publicBaseUrl) fail('WHATSAPP_* terisi tapi PUBLIC_BASE_URL kosong — Meta tidak bisa menghubungi server');
    if (!config.whatsapp.appSecret) warn('WHATSAPP_APP_SECRET kosong: peran pemilik tidak bisa diverifikasi');
  } else {
    info('WhatsApp nonaktif (opsional, butuh URL webhook HTTPS publik)');
  }
  return true;
}

function checkConfig() {
  head('Konfigurasi dasar');
  if (config.port === 3000) info(`port ${config.port} (default)`);
  else info(`port ${config.port}`);
  if (config.appApiKey) ok('APP_API_KEY diisi — endpoint /api terkunci');
  else warn('APP_API_KEY kosong — endpoint /api terbuka untuk siapa pun (isi untuk produksi)');
  if (config.ai.stt.mode !== 'browser' && config.ai.groq.apiKey) ok('transkripsi suara di server aktif (Groq Whisper)');
  else info('transkripsi suara memakai mikrofon browser');
  return true;
}

(async () => {
  console.log(`${BOLD}OmniStaff AI — pemeriksaan konfigurasi${RESET}`);
  let allOk = true;
  if (only('--config')) checkConfig();
  if (only('--db')) allOk = (await checkDatabase()) && allOk;
  if (only('--ai')) allOk = (await checkAi()) && allOk;
  if (only('--channels')) await checkChannels();

  head('Ringkasan');
  if (allOk) console.log(`  ${GREEN}Siap dijalankan.${RESET} npm start\n`);
  else console.log(`  ${YELLOW}Ada yang perlu diperbaiki.${RESET} Lihat catatan di atas.\n`);

  // Tutup pool MySQL lalu andalkan event loop untuk keluar sendiri. Memaksa process.exit()
  // saat socket fetch masih hidup memicu assertion libuv di Windows.
  await db.close().catch(() => {});
  process.exitCode = allOk ? 0 : 1;
})().catch(async (err) => {
  console.error(`${RED}doctor gagal:${RESET}`, err.message);
  await db.close().catch(() => {});
  process.exitCode = 1;
});
