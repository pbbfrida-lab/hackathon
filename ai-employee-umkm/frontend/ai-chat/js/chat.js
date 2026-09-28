// Logika halaman chat: kirim pesan ke staf AI, plus perintah suara.
(function () {
  'use strict';

  const t = (key, vars) => window.I18N.t(key, vars);
  const $ = (id) => document.getElementById(id);
  const log = $('log');
  const text = $('text');
  const status = $('status');
  const mic = $('mic');
  const sessionId = 'chat-' + Math.random().toString(36).slice(2, 8);
  let pristine = false;

  function add(role, who, content, imageUrl) {
    const div = document.createElement('div');
    div.className = 'msg ' + role;
    if (who) { const s = document.createElement('small'); s.textContent = who; div.append(s); }
    div.append(document.createTextNode(content));
    if (imageUrl) { const img = document.createElement('img'); img.src = imageUrl; img.alt = t('chat.posterAlt'); div.append(img); }
    log.append(div);
    log.scrollTop = log.scrollHeight;
    pristine = false;
  }

  function greet() {
    add('bot', t('chat.greetWho'), t('chat.greeting'), null);
    pristine = true;
  }

  async function send(message, viaVoice) {
    add('user', '', message);
    $('send').disabled = true;
    status.textContent = t('chat.working');
    try {
      const path = viaVoice ? '/api/ai/voice' : '/api/ai/chat';
      const body = viaVoice ? { transcript: message, sessionId } : { message, sessionId };
      const r = await api(path, { method: 'POST', body: JSON.stringify(body) });
      add('bot', r.staff, r.reply, r.imageUrl);
      if ($('speak').checked) Voice.speak(r.reply);
      status.textContent = '';
    } catch (e) {
      add('bot', t('chat.system'), e.message, null);
      status.textContent = '';
    } finally {
      $('send').disabled = false;
    }
  }

  $('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const m = text.value.trim();
    if (!m) return;
    text.value = '';
    send(m, false);
  });

  mic.addEventListener('click', () => {
    if (!Voice.supported) { status.textContent = t('chat.unsupported'); return; }
    Voice.listen((transcript) => send(transcript, true), (state) => {
      mic.classList.toggle('on', state === 'listening');
      if (state === 'listening') status.textContent = t('chat.listening');
      else if (state.startsWith('error')) status.textContent = t('chat.micFailed', { reason: state.slice(6) });
      else if (state === 'idle' && status.textContent === t('chat.listening')) status.textContent = '';
    });
  });

  greet();

  window.I18N.onLangChange(() => {
    if (!pristine) return;
    log.textContent = '';
    greet();
  });
})();
