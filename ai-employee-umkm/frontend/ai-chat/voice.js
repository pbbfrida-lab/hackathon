// Pengelola mikrofon (Web Speech API, bahasa Indonesia) dan suara balasan (speechSynthesis).
(function () {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  window.Voice = {
    supported: Boolean(SR),
    listen(onResult, onState) {
      if (!SR) { onState && onState('unsupported'); return null; }
      const rec = new SR();
      rec.lang = 'id-ID';
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
      const u = new SpeechSynthesisUtterance(text.replace(/\(Mode demo[^)]*\)/, ''));
      u.lang = 'id-ID';
      window.speechSynthesis.speak(u);
    },
  };
})();
