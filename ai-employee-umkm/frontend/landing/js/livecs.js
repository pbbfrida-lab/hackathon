/* Widget live customer service untuk landing page.
   Berbicara dengan /api/public/chat (peran 'customer', sudah ada rate limit di server).
   Anti-spam sisi klien: satu permintaan pada satu waktu, tombol nonaktif saat menunggu. */
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const t = (key, vars) => window.I18N.t(key, vars);
  const SESSION_KEY = 'omnistaff_public_session';
  const HISTORY_KEY = 'omnistaff_public_history';
  const MAX_HISTORY = 40;
  const rupiah = (n) => window.I18N.rupiah(n);

  const els = {
    panel: null, log: null, form: null, field: null, send: null,
    close: null, reset: null, suggestions: null,
    statusDot: null, statusText: null, launcher: null,
  };

  let sessionId = null;
  let conversation = [];
  let busy = false;
  let greeted = false;
  let statusKind = 'online';
  let statusKey = 'landing.csConnecting';
  let statusVars = null;

  try { sessionId = localStorage.getItem(SESSION_KEY) || null; } catch (e) { sessionId = null; }

  function headers() {
    const h = { 'Content-Type': 'application/json', 'x-omnistaff-lang': window.I18N.lang() };
    if (sessionId) h['x-omnistaff-session'] = sessionId;
    return h;
  }

  function rememberSession(id) {
    if (!id) return;
    sessionId = id;
    try { localStorage.setItem(SESSION_KEY, id); } catch (e) { /* storage penuh/ditolak */ }
    persistConversation();
  }

  function persistConversation() {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify({ sessionId, messages: conversation.slice(-MAX_HISTORY) }));
    } catch (e) { /* storage penuh/ditolak */ }
  }

  function restoreConversation() {
    try {
      const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || 'null');
      if (!saved || saved.sessionId !== sessionId || !Array.isArray(saved.messages)) return;
      conversation = saved.messages
        .filter((message) => message && typeof message.text === 'string')
        .slice(-MAX_HISTORY);
      for (const message of conversation) {
        addBubble(message.text, message.who, {
          error: Boolean(message.error),
          sys: Boolean(message.sys),
          greet: Boolean(message.greet),
          persist: false,
        });
      }
      greeted = conversation.length > 0;
    } catch (e) { conversation = []; }
  }

  function scrollDown() {
    if (els.log) els.log.scrollTop = els.log.scrollHeight;
  }

  function addBubble(text, who, { error = false, sys = false, greet = false, persist = true } = {}) {
    if (!els.log) return;
    const div = document.createElement('div');
    div.className = 'cs-msg ' + (sys ? 'sys' : error ? 'err' : who === 'me' ? 'me' : 'bot');
    if (!sys && !error && who === 'bot') {
      const tag = document.createElement('span');
      tag.className = 'who';
      tag.textContent = t('cs.who');
      div.appendChild(tag);
    }
    div.appendChild(document.createTextNode(text));
    els.log.appendChild(div);
    if (persist && text) {
      conversation.push({ text, who, error, sys, greet });
      conversation = conversation.slice(-MAX_HISTORY);
      persistConversation();
    }
    scrollDown();
    return div;
  }

  function showTyping() {
    if (!els.log) return null;
    const div = document.createElement('div');
    div.className = 'cs-msg bot';
    div.id = 'csTyping';
    div.innerHTML = '<span class="cs-dots"><i></i><i></i><i></i></span>';
    els.log.appendChild(div);
    scrollDown();
    return div;
  }

  function setStatus(kind, key, vars) {
    statusKind = kind;
    statusKey = key;
    statusVars = vars || null;
    if (els.statusDot) els.statusDot.className = 'dot ' + kind;
    if (els.statusText) els.statusText.textContent = t(key, statusVars);
  }

  function restoreStatusText() {
    if (els.statusDot) els.statusDot.className = 'dot ' + statusKind;
    if (els.statusText) els.statusText.textContent = t(statusKey, statusVars);
  }

  function setBusy(state) {
    busy = state;
    if (els.send) els.send.disabled = state;
    if (els.field) els.field.disabled = state;
    if (els.reset) els.reset.disabled = state;
  }

  async function send(text) {
    const message = String(text || '').trim();
    if (!message || busy) return;
    addBubble(message, 'me');
    setBusy(true);
    setStatus('online', 'cs.typing');
    const typing = showTyping();

    try {
      const res = await fetch('/api/public/chat', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ message }),
      });
      rememberSession(res.headers.get('x-omnistaff-session'));
      const data = await res.json().catch(() => ({}));
      if (typing) typing.remove();

      if (!res.ok) {
        addBubble(t('cs.requestFailed', { status: res.status }), 'bot', { error: true });
        setStatus('off', 'cs.connectionProblem');
        return;
      }

      addBubble(data.reply || t('cs.noAnswer'), 'bot');
      if (data.order) {
        addBubble(t('cs.orderRecorded', { id: data.order.id, total: rupiah(data.order.total) }), 'bot', { sys: true });
      }
      if (data.imageUrl) {
        const holder = addBubble('', 'bot');
        const img = document.createElement('img');
        img.src = data.imageUrl;
        img.alt = t('cs.posterAlt');
        img.loading = 'lazy';
        holder.appendChild(img);
        scrollDown();
      }
      setStatus('online', 'cs.available24');
    } catch (err) {
      if (typing) typing.remove();
      addBubble(t('cs.connectionLost'), 'bot', { error: true });
      setStatus('off', 'cs.offline');
    } finally {
      setBusy(false);
      if (els.field) els.field.focus();
    }
  }

  async function loadSuggestions() {
    if (!els.suggestions) return;
    try {
      const data = await fetch('/api/public/suggestions', { headers: { 'x-omnistaff-lang': window.I18N.lang() } }).then((r) => r.json());
      els.suggestions.innerHTML = '';
      for (const item of data.items || []) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = item;
        btn.addEventListener('click', () => send(item));
        els.suggestions.appendChild(btn);
      }
    } catch (e) { /* saran hanya pemanis */ }
  }

  function greet() {
    if (greeted || !els.log) return;
    greeted = true;
    addBubble(t('cs.greeting1'), 'bot', { greet: true });
    addBubble(t('cs.greeting2'), 'bot', { greet: true });
    loadSuggestions();
  }

  function onLangChange() {
    restoreStatusText();
    document.querySelectorAll('.cs-msg .who').forEach((tag) => { tag.textContent = t('cs.who'); });
    if (!conversation.length || !conversation.every((message) => message.greet)) return;
    conversation = [];
    greeted = false;
    persistConversation();
    if (els.log) els.log.innerHTML = '';
    if (els.panel && !els.panel.hidden) greet();
  }

  function open(prefill) {
    if (!els.panel) return;
    els.panel.hidden = false;
    if (els.launcher) els.launcher.style.display = 'none';
    greet();
    if (prefill) {
      if (els.field) els.field.value = prefill;
      send(prefill);
    } else if (els.field) {
      setTimeout(() => els.field.focus(), 60);
    }
  }

  function close() {
    if (!els.panel) return;
    els.panel.hidden = true;
    if (els.launcher) els.launcher.style.display = '';
  }

  function toggle() {
    if (!els.panel) return;
    if (els.panel.hidden) open();
    else close();
  }

  function reset() {
    const previousSessionId = sessionId;
    try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* abaikan */ }
    try { localStorage.removeItem(HISTORY_KEY); } catch (e) { /* abaikan */ }
    sessionId = null;
    conversation = [];
    greeted = false;
    if (els.log) els.log.innerHTML = '';
    const resetHeaders = previousSessionId ? { 'x-omnistaff-session': previousSessionId } : {};
    fetch('/api/public/reset', { method: 'POST', headers: resetHeaders }).catch(() => {});
    greet();
  }

  function init() {
    els.panel = $('#csPanel');
    els.log = $('#csLog');
    els.form = $('#csForm');
    els.field = $('#csField');
    els.send = $('#csSend');
    els.close = $('#csClose');
    els.reset = $('#csReset');
    els.suggestions = $('#csSuggestions');
    els.statusDot = $('#csStatusDot');
    els.statusText = $('#csStatusText');
    els.launcher = $('#csLauncher');
    restoreConversation();
    window.I18N.onLangChange(onLangChange);

    document.querySelectorAll('[data-open-cs]').forEach((el) => el.addEventListener('click', (e) => {
      e.preventDefault();
      open();
    }));
    if (els.close) els.close.addEventListener('click', close);
    if (els.reset) els.reset.addEventListener('click', reset);
    if (els.launcher) els.launcher.addEventListener('click', toggle);
    if (els.form) {
      els.form.addEventListener('submit', (e) => {
        e.preventDefault();
        const value = els.field.value;
        els.field.value = '';
        send(value);
      });
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && els.panel && !els.panel.hidden) close();
    });

    // Status staf AI di header widget, sekalian memeriksa apakah AI hidup.
    fetch('/api/public/status', { headers: { 'x-omnistaff-lang': window.I18N.lang() } })
      .then((r) => r.json())
      .then((s) => setStatus(s.ai_live ? 'online' : 'demo', s.ai_live ? 'cs.available24' : 'cs.demoMode'))
      .catch(() => setStatus('off', 'cs.offline'));
  }

  window.LiveCS = { open, close, toggle, send };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
