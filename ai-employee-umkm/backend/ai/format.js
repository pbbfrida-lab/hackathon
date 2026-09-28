// Penyucian teks jawaban AI supaya aman di semua kanal: web (textContent), Telegram (Markdown),
// dan WhatsApp (plain text). Model sering mengembalikan markdown, thin space (U+202F),
// atau baris kosong bertumpuk yang membuat tampilan kanal chat berantakan.

const EXOTIC_SPACES = /[\u00a0\u1680\u2000-\u200b\u202f\u205f\u3000]/g;

/** Ubah "jawaban model" menjadi teks polos yang aman ditampilkan di kanal mana pun. */
function sanitizeReply(text) {
  if (text == null) return '';
  return String(text)
    .replace(EXOTIC_SPACES, ' ')     // U+202F & sejenisnya -> spasi biasa
    .replace(/```[a-z]*\n?/gi, '')   // buang fence kode
    .replace(/\*\*([^*]+)\*\*/g, '$1') // **tebal** -> teks
    .replace(/__([^_]+)__/g, '$1')     // __tebal__ -> teks
    .replace(/`([^`]+)`/g, '$1')       // `kode` -> kode
    .replace(/^\s{0,3}#{1,6}\s+/gm, '') // heading markdown
    .replace(/[ \t]+$/gm, '')          // spasi di akhir baris
    .replace(/\n{3,}/g, '\n\n')        // maksimal satu baris kosong
    .trim();
}

module.exports = { sanitizeReply };
