// Speech-to-Text. Jalur utama: browser (Web Speech API) mengirim transkrip.
// Jalur opsional: kirim audio base64 ke STT_API_URL (adapter generik, sesuaikan dengan penyedia STT Anda).
function httpError(status, message) {
  return Object.assign(new Error(message), { statusCode: status, expose: true });
}

async function transcribe({ transcript, audioBase64, mimeType }) {
  if (transcript && String(transcript).trim()) {
    return String(transcript).replace(/\s+/g, ' ').trim();
  }
  if (audioBase64 && process.env.STT_API_URL) {
    const res = await fetch(process.env.STT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(process.env.STT_API_KEY ? { Authorization: `Bearer ${process.env.STT_API_KEY}` } : {}) },
      body: JSON.stringify({ audio: audioBase64, mimeType: mimeType || 'audio/webm', language: 'id' }),
    });
    if (!res.ok) throw httpError(502, `STT API error ${res.status}`);
    const data = await res.json();
    if (!data.text) throw httpError(502, 'Respons STT tidak berisi field "text".');
    return String(data.text).trim();
  }
  throw httpError(400, 'Kirim "transcript" dari mikrofon browser, atau atur STT_API_URL untuk transkripsi audio di server.');
}

module.exports = { transcribe };
