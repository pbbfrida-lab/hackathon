// Status staf virtual (disimpan di memori) -> dibaca dashboard 3D lewat GET /api/staff.
const db = require('../../backend/services/db');

const staff = {
  cs:        { id: 'cs',        name: 'Sari',  role: 'Customer Service', status: 'idle', task: 'Siap melayani pelanggan', updatedAt: Date.now() },
  inventory: { id: 'inventory', name: 'Gudi',  role: 'Manajer Inventaris', status: 'idle', task: 'Stok terpantau', updatedAt: Date.now() },
  finance:   { id: 'finance',   name: 'Fina',  role: 'Analis Keuangan', status: 'idle', task: 'Laporan siap', updatedAt: Date.now() },
  marketing: { id: 'marketing', name: 'Mika',  role: 'Desainer Promosi', status: 'idle', task: 'Menunggu brief promosi', updatedAt: Date.now() },
};

const IDLE_TASKS = {
  cs: 'Siap melayani pelanggan',
  inventory: 'Stok terpantau',
  finance: 'Laporan siap',
  marketing: 'Menunggu brief promosi',
};

function list() {
  return Object.values(staff);
}

function setWorking(id, task) {
  if (!staff[id]) return;
  Object.assign(staff[id], { status: 'working', task, updatedAt: Date.now() });
  db.query('INSERT INTO staff_activity (staff_id, action) VALUES (?, ?)', [id, String(task).slice(0, 250)]).catch(() => {});
}

function setIdle(id) {
  if (!staff[id]) return;
  Object.assign(staff[id], { status: 'idle', task: IDLE_TASKS[id], updatedAt: Date.now() });
}

module.exports = { list, setWorking, setIdle };
