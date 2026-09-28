// Pengelola mikrofon (Web Speech API) dan suara balasan (speechSynthesis).
// Bahasa rekam/ucapan mengikuti pilihan bahasa di I18N (id-ID atau en-US).
(function () {
  'use strict';

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const locale = () => (window.I18N ? window.I18N.locale() : 'id-ID');

  window.Voice = {
    supported: Boolean(SR),
    listen(onResult, onState) {
      if (!SR) { onState && onState('unsupported'); return null; }
      const rec = new SR();
      rec.lang = locale();
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onstart = () => onState && onState('listening');
      rec.onend = () => onState && onState('idle');
      rec.onerror = (e) => onState && onState('error:' + e.error);
      rec.onresult = (e) => onResult(e.results[0][0].transcript);
      rec.start();
      return rec;
    },
    speak(text) {
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/\((Mode demo|Demo mode)[^)]*\)/i, ''));
      u.lang = locale();
      window.speechSynthesis.speak(u);
    },
  };
})();
