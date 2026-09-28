// Speech-to-Text.
// Jalur utama: browser memakai Web Speech API lalu mengirim "transcript" ke backend (gratis, tanpa key).
// Jalur server: Groq Whisper (free tier 8 jam/hari) atau endpoint STT generik via STT_API_URL.
const config = require('../config');
const { badRequest, badGateway } = require('../lib/errors');
const { postJson } = require('./http');
const logger = require('../lib/logger').create('stt');

const MAX_AUDIO_BYTES = 8 * 1024 * 1024; // 8 MB

function decodeBase64(audioBase64) {
  const raw = String(audioBase64).replace(/^data:[\w/+.-]+;base64,/, '');
  return Buffer.from(raw, 'base64');
}

function extensionFor(mimeType) {
  const mime = String(mimeType || '').toLowerCase();
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  if (mime.includes('mp4')) return 'm4a';
  if (mime.includes('flac')) return 'flac';
  return 'webm';
}

/** Transkripsi lewat Groq Whisper (OpenAI-compatible /audio/transcriptions, multipart). */
async function transcribeWithGroq(buffer, filename) {
  const form = new FormData();
  form.append('file', new Blob([buffer]), filename);
  form.append('model', config.ai.groq.sttModel);
  form.append('language', 'id');
  form.append('response_format', 'json');
  form.append('prompt', 'Percakapan Bahasa Indonesia tentang toko, produk, harga, dan pesanan.');

  const res = await fetch(`${config.ai.groq.baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.ai.groq.apiKey}` },
    body: form,
    signal: AbortSignal.timeout(config.ai.requestTimeoutMs),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw badGateway(`Groq Whisper error ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  if (!data.text) throw badGateway('Groq Whisper tidak mengembalikan teks.');
  return String(data.text).trim();
}

/** Transkripsi lewat endpoint STT generik ({ audio, mimeType, language } -> { text }). */
async function transcribeWithGenericApi(buffer, mimeType) {
  const data = await postJson(config.ai.stt.genericUrl, {
    provider: 'stt',
    headers: config.ai.stt.genericKey ? { Authorization: `Bearer ${config.ai.stt.genericKey}` } : {},
    body: { audio: buffer.toString('base64'), mimeType: mimeType || 'audio/webm', language: 'id' },
  });
  if (!data.text) throw badGateway('Respons STT tidak berisi field "text".');
  return String(data.text).trim();
}

/**
 * Ubah audio (base64) atau transcript browser menjadi teks.
 * Mengembalikan { text, via }.
 */
async function transcribe({ transcript, audioBase64, mimeType } = {}) {
  // 1. Transkrip dari browser: tidak butuh key sama sekali.
  if (transcript && String(transcript).trim()) {
    return { text: String(transcript).replace(/\s+/g, ' ').trim(), via: 'browser' };
  }
  if (!audioBase64) {
    throw badRequest('Kirim "transcript" dari mikrofon browser, atau "audioBase64" untuk transkripsi di server.');
  }

  const buffer = decodeBase64(audioBase64);
  if (!buffer.length) throw badRequest('Audio kosong (audioBase64 tidak valid).');
  if (buffer.length > MAX_AUDIO_BYTES) throw badRequest('Ukuran audio maksimal 8 MB.');

  const filename = `voice.${extensionFor(mimeType)}`;

  // 2. Groq Whisper.
  if (config.ai.stt.mode !== 'browser' && config.ai.groq.apiKey) {
    try {
      return { text: await transcribeWithGroq(buffer, filename), via: 'groq-whisper' };
    } catch (err) {
      logger.warn('Groq Whisper gagal:', err.message);
    }
  }

  // 3. Endpoint STT generik.
  if (config.ai.stt.genericUrl) {
    try {
      return { text: await transcribeWithGenericApi(buffer, mimeType), via: 'stt-api' };
    } catch (err) {
      logger.warn('STT API gagal:', err.message);
    }
  }

  throw badGateway(
    'Transkripsi audio di server belum aktif. Isi GROQ_API_KEY (Whisper gratis) atau STT_API_URL, '
    + 'atau pakai mikrofon browser yang mengirim transcript.'
  );
}

module.exports = { transcribe };
