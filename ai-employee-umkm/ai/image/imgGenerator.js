// Pembuat aset promosi. Jika IMAGE_API_URL diatur, kirim prompt ke sana;
// jika tidak, buat poster SVG lokal supaya demo tetap berjalan.
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.resolve(__dirname, '../../frontend/assets/promotions');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rupiah = (n) => 'Rp' + Number(n).toLocaleString('id-ID');

function wrap(text, max) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max) { lines.push(cur.trim()); cur = w; } else cur += ' ' + w;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines.slice(0, 3);
}

function buildSvg({ product, headline }) {
  const title = wrap(headline || product.name, 18);
  const desc = wrap(product.description || '', 34);
  const palettes = [['#23306b', '#f2a516'], ['#0f5c55', '#ffd166'], ['#7a1f3d', '#ffe0b2']];
  const [bg, accent] = palettes[product.id % palettes.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <rect width="1080" height="1350" fill="${bg}"/>
  <circle cx="900" cy="230" r="320" fill="${accent}" opacity="0.18"/>
  <circle cx="140" cy="1180" r="260" fill="${accent}" opacity="0.14"/>
  <text x="90" y="170" font-family="Georgia, serif" font-size="34" fill="${accent}">Produk UMKM Pilihan</text>
  ${title.map((l, i) => `<text x="90" y="${380 + i * 120}" font-family="Georgia, serif" font-weight="700" font-size="104" fill="#ffffff">${esc(l)}</text>`).join('\n  ')}
  ${desc.map((l, i) => `<text x="90" y="${380 + title.length * 120 + 40 + i * 52}" font-family="Arial, sans-serif" font-size="40" fill="#e8ebf7">${esc(l)}</text>`).join('\n  ')}
  <rect x="90" y="1060" width="560" height="140" rx="70" fill="${accent}"/>
  <text x="130" y="1150" font-family="Arial, sans-serif" font-weight="700" font-size="76" fill="${bg}">${esc(rupiah(product.price))}</text>
  <text x="90" y="1270" font-family="Arial, sans-serif" font-size="34" fill="#ffffff">Pesan sekarang lewat chat</text>
</svg>`;
}

// PNG dibutuhkan Telegram/WhatsApp (SVG tidak didukung). Opsional: butuh paket "sharp".
async function toPng(svg, pngPath) {
  try {
    const sharp = require('sharp');
    await sharp(Buffer.from(svg)).png().toFile(pngPath);
    return true;
  } catch (e) {
    return false;
  }
}

async function generatePromo({ product, headline, style }) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = Date.now();

  if (process.env.IMAGE_API_URL) {
    const prompt = `Poster promosi produk UMKM Indonesia: ${product.name}. ${product.description || ''}. Harga ${rupiah(product.price)}. Gaya: ${style || 'hangat, modern, bersih'}.`;
    const res = await fetch(process.env.IMAGE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(process.env.IMAGE_API_KEY ? { Authorization: `Bearer ${process.env.IMAGE_API_KEY}` } : {}) },
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) throw Object.assign(new Error(`Image API error ${res.status}`), { statusCode: 502 });
    const data = await res.json();
    if (data.url) return { url: data.url, remoteUrl: data.url, mode: 'api', product: product.name };
    if (data.b64) {
      const file = `promo-${stamp}.png`;
      const full = path.join(OUT_DIR, file);
      fs.writeFileSync(full, Buffer.from(data.b64, 'base64'));
      return { url: `/assets/promotions/${file}`, file: full, pngFile: full, pngUrl: `/assets/promotions/${file}`, mode: 'api', product: product.name };
    }
    throw Object.assign(new Error('Respons Image API tidak berisi url atau b64'), { statusCode: 502 });
  }

  const svg = buildSvg({ product, headline });
  const file = `promo-${stamp}.svg`;
  const full = path.join(OUT_DIR, file);
  fs.writeFileSync(full, svg, 'utf8');
  const result = { url: `/assets/promotions/${file}`, file: full, mode: 'local-svg', product: product.name };
  const pngName = `promo-${stamp}.png`;
  if (await toPng(svg, path.join(OUT_DIR, pngName))) {
    result.pngFile = path.join(OUT_DIR, pngName);
    result.pngUrl = `/assets/promotions/${pngName}`;
  }
  return result;
}

module.exports = { generatePromo };
