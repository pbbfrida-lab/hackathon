(function () {
  const $ = (id) => document.getElementById(id);

  function renderStaff(list) {
    const ul = $('staff-list');
    ul.textContent = '';
    list.forEach((s) => {
      const li = document.createElement('li');
      const dot = document.createElement('span');
      dot.className = 'dot' + (s.status === 'working' ? ' working' : '');
      const box = document.createElement('div');
      const name = document.createElement('b'); name.textContent = s.name;
      const role = document.createElement('small'); role.textContent = s.role;
      const task = document.createElement('p'); task.textContent = s.task;
      box.append(name, role, task);
      li.append(dot, box);
      ul.append(li);
    });
    if (window.OfficeScene) window.OfficeScene.update(list);
  }

  async function pollStaff() {
    try { renderStaff(await api('/api/staff')); } catch (e) { /* server mungkin belum siap */ }
  }

  async function loadToday() {
    try {
      const r = await api('/api/reports/daily');
      $('n-orders').textContent = r.orders;
      $('n-revenue').textContent = rupiah(r.revenue);
      $('n-profit').textContent = rupiah(r.profit);
    } catch (e) {
      $('n-orders').textContent = '–';
    }
  }

  async function loadChannels() {
    try {
      const h = await fetch('/api/health').then((r) => r.json());
      const rows = [['Telegram', h.channels.telegram, h.channels.telegram === 'off' ? 'belum diaktifkan' : `aktif (${h.channels.telegram})`],
                    ['WhatsApp', h.channels.whatsapp, h.channels.whatsapp === 'off' ? 'belum diaktifkan' : 'aktif (webhook)']];
      const ul = $('channel-list'); ul.textContent = '';
      rows.forEach(([name, state, label]) => {
        const li = document.createElement('li');
        const dot = document.createElement('span'); dot.className = 'dot' + (state !== 'off' ? ' working' : '');
        const box = document.createElement('div');
        const b = document.createElement('b'); b.textContent = name;
        const p = document.createElement('p'); p.textContent = label;
        box.append(b, p); li.append(dot, box); ul.append(li);
      });
    } catch (e) { /* abaikan */ }
  }

  $('cmd-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('cmd-input');
    const message = input.value.trim();
    if (!message) return;
    const btn = $('cmd-send'), box = $('reply');
    btn.disabled = true;
    box.className = 'show'; box.textContent = 'Staf sedang bekerja…';
    pollStaff();
    try {
      const r = await api('/api/ai/chat', { method: 'POST', body: JSON.stringify({ message, sessionId: 'dashboard' }) });
      box.textContent = `${r.staff}: ${r.reply}`;
      if (r.imageUrl) {
        const img = document.createElement('img');
        img.src = r.imageUrl; img.alt = 'Poster promosi hasil buatan staf';
        box.append(img);
      }
      input.value = '';
      loadToday();
    } catch (err) {
      box.textContent = err.message;
      box.classList.add('error');
    } finally {
      btn.disabled = false;
      pollStaff();
    }
  });

  pollStaff(); loadToday(); loadChannels();
  setInterval(pollStaff, 2000);
  setInterval(loadToday, 30000);
})();
