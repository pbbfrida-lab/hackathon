// Pembuat poster promosi.
// Dua jalur: IMAGE_API_URL untuk API gambar eksternal, atau poster SVG yang dibuat lokal.
// SVG tidak bisa dikirim ke Telegram/WhatsApp, jadi dikonversi ke PNG bila paket "sharp" terpasang.
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { postJson } = require('./http');
const logger = require('../lib/logger').create('poster');

const OUT_DIR = path.resolve(__dirname, '../../frontend/assets/promotions');
const MAX_HEADLINE_LINES = 3;
const MAX_DESC_LINES = 3;

const escapeXml = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const rupiah = (n) => `Rp${Number(n || 0).toLocaleString('id-ID')}`;

/** Bungkus teks menjadi maksimal `max` baris dengan lebar karakter tertentu. */
function wrap(text, max, maxLines) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    if (!current) current = word;
    else if ((`${current} ${word}`).length <= max) current += ` ${word}`;
    else { lines.push(current); current = word; }
    if (lines.length === maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines.slice(0, maxLines);
}

const PALETTES = [
  { bg: '#23306b', accent: '#f2a516', ink: '#ffffff', sub: '#e8ebf7' },
  { bg: '#0f5c55', accent: '#ffd166', ink: '#ffffff', sub: '#dff3ee' },
  { bg: '#7a1f3d', accent: '#ffe0b2', ink: '#ffffff', sub: '#f7e2e8' },
  { bg: '#2b2118', accent: '#e07a3f', ink: '#fff8f0', sub: '#f0e2d6' },
];

/** Template poster 1080x1350 (rasio 4:5, standar feed media sosial). */
function buildSvg({ product, headline }) {
  const palette = PALETTES[(product.id || 0) % PALETTES.length];
  const title = wrap(headline || product.name, 16, MAX_HEADLINE_LINES);
  const desc = wrap(product.description || '', 42, MAX_DESC_LINES);
  const titleY = 300;
  const descStart = titleY + title.length * 118 + 30;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350" role="img" aria-label="Poster ${escapeXml(product.name)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${palette.bg}"/>
      <stop offset="100%" stop-color="${palette.accent}" stop-opacity="0.35"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1350" fill="url(#bg)"/>
  <circle cx="920" cy="220" r="330" fill="${palette.accent}" opacity="0.16"/>
  <circle cx="130" cy="1190" r="270" fill="${palette.accent}" opacity="0.12"/>
  <rect x="90" y="110" width="${26 + escapeXml(product.sku || '').length * 16}" height="52" rx="26" fill="${palette.accent}" opacity="0.9"/>
  <text x="${103 + escapeXml(product.sku || '').length * 8}" y="146" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="${palette.bg}">${escapeXml(product.sku || 'UMKM')}</text>
  ${title.map((line, i) => `<text x="90" y="${titleY + i * 118}" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="102" fill="${palette.ink}">${escapeXml(line)}</text>`).join('\n  ')}
  ${desc.map((line, i) => `<text x="90" y="${descStart + i * 54}" font-family="Arial, sans-serif" font-size="40" fill="${palette.sub}">${escapeXml(line)}</text>`).join('\n  ')}
  <rect x="90" y="1050" width="620" height="150" rx="75" fill="${palette.accent}"/>
  <text x="135" y="1148" font-family="Arial, sans-serif" font-weight="700" font-size="80" fill="${palette.bg}">${escapeXml(rupiah(product.price))}</text>
  <text x="90" y="1268" font-family="Arial, sans-serif" font-size="36" fill="${palette.ink}">Stok tersedia${product.stock <= product.low_stock_threshold ? ' — tinggal sedikit!' : ''}</text>
  <text x="90" y="1320" font-family="Arial, sans-serif" font-size="30" fill="${palette.sub}">Pesan sekarang lewat chat</text>
</svg>`;
}

let sharpModule;
function loadSharp() {
  if (sharpModule !== undefined) return sharpModule;
  try {
    sharpModule = require('sharp');
  } catch (err) {
    sharpModule = null;
    logger.info('paket "sharp" tidak terpasang: poster hanya tersedia sebagai SVG (belum bisa dikirim ke Telegram). Jalankan: npm install sharp');
  }
  return sharpModule;
}

async function svgToPng(svg, pngPath) {
  const sharp = loadSharp();
  if (!sharp) return false;
  try {
    await sharp(Buffer.from(svg), { density: 96 }).png().toFile(pngPath);
    return true;
  } catch (err) {
    logger.warn('gagal membuat PNG:', err.message);
    return false;
  }
}

function cleanupOldFiles(maxFiles = 40) {
  try {
    const files = fs.readdirSync(OUT_DIR)
      .filter((f) => f.startsWith('promo-'))
      .map((f) => ({ f, t: fs.statSync(path.join(OUT_DIR, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    for (const old of files.slice(maxFiles)) {
      fs.unlinkSync(path.join(OUT_DIR, old.f));
    }
  } catch (err) {
    logger.debug('gagal membersihkan poster lama:', err.message);
  }
}

async function generateViaApi({ product, headline, style }) {
  const prompt = [
    `Poster promosi untuk produk UMKM Indonesia.`,
    `Produk: ${product.name}.`,
    product.description ? `Deskripsi: ${product.description}.` : '',
    `Harga: ${rupiah(product.price)}.`,
    headline ? `Kalimat utama: "${headline}".` : '',
    `Gaya: ${style || 'hangat, modern, bersih, warna earth tone'}.`,
    `Tanpa watermark, tanpa teks gibberish, komposisi vertikal.`,
  ].filter(Boolean).join(' ');

  const data = await postJson(config.ai.image.url, {
    provider: 'image-api',
    headers: config.ai.image.key ? { Authorization: `Bearer ${config.ai.image.key}` } : {},
    body: { prompt, model: process.env.IMAGE_API_MODEL, size: '1024x1024' },
  });

  if (data.url || (data.data && data.data[0] && data.data[0].url)) {
    const url = data.url || data.data[0].url;
    return { url, remoteUrl: url, pngUrl: url, mode: 'api', product: product.name };
  }

  const b64 = data.b64 || (data.data && data.data[0] && data.data[0].b64_json);
  if (!b64) {
    const err = new Error('Respons API gambar tidak berisi url atau b64.');
    err.statusCode = 502;
    throw err;
  }
  const file = `promo-${Date.now()}.png`;
  const full = path.join(OUT_DIR, file);
  fs.writeFileSync(full, Buffer.from(b64.replace(/^data:image\/\w+;base64,/, ''), 'base64'));
  return { url: `/assets/promotions/${file}`, pngUrl: `/assets/promotions/${file}`, pngFile: full, file: full, mode: 'api', product: product.name };
}

/**
 * Buat poster untuk satu produk.
 * Selalu mengembalikan { url, pngUrl?, pngFile?, mode, product }.
 */
async function generatePromo({ product, headline, style }) {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  if (config.ai.image.url) {
    try {
      return await generateViaApi({ product, headline, style });
    } catch (err) {
      logger.warn('API gambar gagal, jatuh ke poster SVG lokal:', err.message);
    }
  }

  const stamp = Date.now();
  const svg = buildSvg({ product, headline });
  const svgName = `promo-${stamp}.svg`;
  const svgPath = path.join(OUT_DIR, svgName);
  fs.writeFileSync(svgPath, svg, 'utf8');

  const result = {
    url: `/assets/promotions/${svgName}`,
    file: svgPath,
    mode: 'local-svg',
    product: product.name,
  };

  const pngName = `promo-${stamp}.png`;
  if (await svgToPng(svg, path.join(OUT_DIR, pngName))) {
    result.pngFile = path.join(OUT_DIR, pngName);
    result.pngUrl = `/assets/promotions/${pngName}`;
  }

  cleanupOldFiles();
  return result;
}

module.exports = { generatePromo, buildSvg, wrap, OUT_DIR };
