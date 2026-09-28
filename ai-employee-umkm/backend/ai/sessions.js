// Riwayat percakapan per sesi, disimpan di memori proses.
// Batas 12 pesan per sesi dan 500 sesi supaya tidak membengkak pada server yang berjalan lama.
const MAX_MESSAGES = 12;
const MAX_SESSIONS = 500;

const sessions = new Map();

function get(id) {
  return (sessions.get(String(id)) || []).map((m) => ({ ...m }));
}

function push(id, role, content) {
  const key = String(id);
  const history = sessions.get(key) || [];
  history.push({ role, content: String(content == null ? '' : content).slice(0, 4000) });
  sessions.delete(key); // Landmarkai paling baru agar urutannya benar saat dipangkas
  sessions.set(key, history.slice(-MAX_MESSAGES));
  while (sessions.size > MAX_SESSIONS) sessions.delete(sessions.keys().next().value);
}

function clear(id) {
  if (id == null) sessions.clear();
  else sessions.delete(String(id));
}

function stats() {
  return { sessions: sessions.size, maxSessions: MAX_SESSIONS, maxMessages: MAX_MESSAGES };
}

module.exports = { get, push, clear, stats };
