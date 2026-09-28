// Status staf virtual. Disimpan di memori proses (dashboard mengambilnya tiap 2 detik),
// dan setiap aktivitas dicatat ke tabel staff_activity untuk jejak audit ringan.
const db = require('../db');
const { normalizeLang } = require('../lib/i18n');
const logger = require('../lib/logger').create('staff');

const IDLE_TASK = {
  id: {
    cs: 'Siap melayani pelanggan',
    inventory: 'Stok terpantau',
    finance: 'Laporan siap',
    marketing: 'Menunggu brief promosi',
  },
  en: {
    cs: 'Ready to serve customers',
    inventory: 'Stock is being monitored',
    finance: 'Report is ready',
    marketing: 'Waiting for a promotion brief',
  },
};

const ROLES = {
  id: { cs: 'Customer Service', inventory: 'Manajer Inventaris', finance: 'Analis Keuangan', marketing: 'Desainer Promosi' },
  en: { cs: 'Customer Service', inventory: 'Inventory Manager', finance: 'Financial Analyst', marketing: 'Promotion Designer' },
};

const SKILLS = {
  id: {
    cs: ['cek stok', 'buat pesanan', 'status pesanan'],
    inventory: ['stok masuk', 'stok menipis'],
    finance: ['laporan harian', 'laba-rugi'],
    marketing: ['poster', 'teks promosi'],
  },
  en: {
    cs: ['stock checks', 'taking orders', 'order status'],
    inventory: ['restocking', 'low stock'],
    finance: ['daily reports', 'profit and loss'],
    marketing: ['posters', 'promotional copy'],
  },
};

const staff = {
  cs: { id: 'cs', name: 'Sari' },
  inventory: { id: 'inventory', name: 'Gudi' },
  finance: { id: 'finance', name: 'Fina' },
  marketing: { id: 'marketing', name: 'Mika' },
};

const timers = new Map();
let seq = 0;

function hydrate() {
  for (const s of Object.values(staff)) {
    s.status = 'idle';
    s.task = IDLE_TASK.id[s.id];
    s.currentTask = null;
    s.startedAt = null;
    s.completed = 0;
    s.updatedAt = Date.now();
  }
}
hydrate();

/** Daftar staf dengan peran, keahlian, dan tugas STATUS_SEDANG_KERJA yang sudah diterjemahkan. */
function list(lang) {
  const code = normalizeLang(lang);
  return Object.values(staff).map((s) => ({
    ...s,
    role: ROLES[code][s.id],
    skills: SKILLS[code][s.id],
    task: s.status === 'idle' ? IDLE_TASK[code][s.id] : s.task,
  }));
}

function get(id) {
  return staff[id] ? { ...staff[id] } : null;
}

/** Tandai staf sedang bekerja. `autoIdleMs` mengembalikan status ke idle otomatis. */
function setWorking(id, task, { autoIdleMs = 4000, log = true } = {}) {
  const member = staff[id];
  if (!member) return;
  Object.assign(member, {
    status: 'working',
    task: String(task).slice(0, 200),
    currentTask: String(task).slice(0, 200),
    startedAt: Date.now(),
    updatedAt: Date.now(),
  });

  if (log) {
    db.run('INSERT INTO staff_activity (staff_id, action) VALUES (?, ?)', [id, member.task])
      .catch((e) => logger.debug('gagal catat aktivitas:', e.message));
  }

  if (autoIdleMs > 0) {
    clearTimeout(timers.get(id));
    timers.set(id, setTimeout(() => setIdle(id), autoIdleMs));
  }
}

function setIdle(id) {
  const member = staff[id];
  if (!member) return;
  clearTimeout(timers.get(id));
  timers.delete(id);
  if (member.status === 'working') member.completed += 1;
  Object.assign(member, {
    status: 'idle',
    task: IDLE_TASK.id[id],
    currentTask: null,
    startedAt: null,
    updatedAt: Date.now(),
  });
}


function setError(id, message) {
  const member = staff[id];
  if (!member) return;
  clearTimeout(timers.get(id));
  timers.delete(id);
  Object.assign(member, {
    status: 'error',
    task: String(message).slice(0, 200),
    currentTask: null,
    startedAt: null,
    updatedAt: Date.now(),
  });
}

/** Bungkus satu pekerjaan: set working -> jalankan -> kembali idle (atau error). */
async function withTask(id, task, fn, { autoIdleMs = 4000 } = {}) {
  setWorking(id, task, { autoIdleMs: 0 });
  try {
    const result = await fn();
    if (autoIdleMs > 0) {
      clearTimeout(timers.get(id));
      timers.set(id, setTimeout(() => setIdle(id), autoIdleMs));
    } else {
      setIdle(id);
    }
    return result;
  } catch (err) {
    setError(id, err.message);
    throw err;
  }
}

function snapshot(lang) {
  return {
    seq: ++seq,
    staff: list(lang),
  };
}

module.exports = { list, get, setWorking, setIdle, setError, withTask, snapshot, IDLE_TASK };
