// Riwayat percakapan per sesi (memori proses, 10 pesan terakhir, maks. 500 sesi).
const sessions = new Map();

function get(id) {
  return sessions.get(id) || [];
}

function push(id, role, content) {
  const h = sessions.get(id) || [];
  h.push({ role, content });
  sessions.delete(id); // pindahkan ke urutan terbaru
  sessions.set(id, h.slice(-10));
  if (sessions.size > 500) sessions.delete(sessions.keys().next().value);
}

module.exports = { get, push };
