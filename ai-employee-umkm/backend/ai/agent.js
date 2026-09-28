// Orkestrator multi-agent.
//
// Alur satu pesan:
//   1. pilih staf  — kata kunci (cepat, gratis) atau router LLM; pelanggan selalu ke Customer Service
//   2. jalankan agent — loop function calling: model -> tool -> hasil -> model (maks AI_MAX_STEPS)
//   3. kembalikan jawaban + daftar aksi + poster bila dibuat
//
// Kalau tidak ada satu pun provider AI yang siap, dipakai mode demo berbasis aturan
// sehingga seluruh alur (staf bergerak, laporan, poster) tetap bisa dicoba tanpa API key.
const config = require('../config');
const logger = require('../lib/logger').create('agent');
const providers = require('./providers');
const tools = require('./tools');
const prompts = require('./prompts');
const { tr: demoTr } = require('./demoText');
const sessions = require('./sessions');
const { sanitizeReply } = require('./format');
const staff = require('../domain/staff');
const products = require('../domain/products');
const reports = require('../domain/reports');

const rupiah = (n) => `Rp${Number(n || 0).toLocaleString('id-ID')}`;

const AGENTS = {
  customer_service: {
    key: 'customer_service', staffId: 'cs', label: 'Sari (Customer Service)',
    tools: ['check_stock', 'list_products', 'search_products', 'create_order', 'get_order_status'],
    keywords: ['pesan', 'beli', 'order', 'harga', 'ada', 'ready', 'tersedia', 'status', 'kirim', 'ongkir', 'produk', 'stok',
      'buy', 'price', 'cost', 'available', 'order status', 'shipping', 'how much'],
  },
  inventory: {
    key: 'inventory', staffId: 'inventory', label: 'Gudi (Inventaris)', labelEn: 'Gudi (Inventory)',
    tools: ['check_stock', 'list_products', 'search_products', 'low_stock_report', 'update_stock'],
    keywords: ['stok', 'stock', 'gudang', 'restock', 'barang masuk', 'hampir habis', 'menipis', 'inventaris', 'modal',
      'inventory', 'warehouse', 'running out', 'low stock', 'restock'],
  },
  finance: {
    key: 'finance', staffId: 'finance', label: 'Fina (Keuangan)', labelEn: 'Fina (Finance)',
    tools: ['daily_report', 'sales_trend', 'get_order_status'],
    keywords: ['laporan', 'omzet', 'laba', 'rugi', 'untung', 'keuangan', 'penjualan', 'pendapatan', 'terlaris', 'rekap',
      'report', 'revenue', 'profit', 'loss', 'sales', 'income', 'best selling', 'earnings'],
  },
  marketing: {
    key: 'marketing', staffId: 'marketing', label: 'Mika (Promosi)', labelEn: 'Mika (Marketing)',
    tools: ['list_products', 'search_products', 'generate_promo_image'],
    keywords: ['poster', 'promosi', 'promo', 'gambar', 'desain', 'iklan', 'banner', 'konten', 'caption',
      'promotion', 'advert', 'banner', 'design', 'flyer', 'content', 'image'],
  },
};

/** Nama staf yang ditampilkan di atas balasan, mengikuti bahasa jawaban. */
function agentLabel(agent, lang) {
  return lang === 'en' && agent.labelEn ? agent.labelEn : agent.label;
}


// Kata kunci paling spesifik diperiksa lebih dulu: "stok" milik CS, tapi "stok menipis" milik Inventaris.
const ROUTE_PRIORITY = ['marketing', 'finance', 'inventory', 'customer_service'];
const STRONG_SIGNALS = {
  marketing: /\b(poster|promosi|promosi|desain|iklan|banner|caption|kerangkaposting|promotion|promotional|advert|advertisement|flyer|design|gambar|image)\b/i,
  finance: /\b(laporan|omzet|laba|rugi|keuangan|rekap|terlaris|penjualan|report|revenue|profit|loss|earnings|best selling|sales)\b/i,
  inventory: /\b(stok|gudang|inventaris|restock|hampir habis|menipis|barang masuk|stock|inventory|warehouse|running out|low stock)\b/i,
  customer_service: /\b(pesan|beli|order|harga|ready|tersedia|ongkir|kirim|status|buy|purchase|price|how much|available)\b/i,
};


function routeByKeyword(message) {
  const text = String(message).toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const key of ROUTE_PRIORITY) {
    const keywords = AGENTS[key].keywords;
    let score = keywords.reduce((sum, k) => sum + (text.includes(k) ? 1 : 0), 0);
    if (STRONG_SIGNALS[key].test(text)) score += 2; // sinyal kuat mengalahkan kata umum
    if (score > bestScore) { best = key; bestScore = score; }
  }
  return best;
}

/** Pilih agen. Pelanggan (chat/Telegram/WA) hanya boleh dilayani Customer Service. */
async function route(message, ctx = {}) {
  if (ctx.role === 'customer') return 'customer_service';

  const byKeyword = routeByKeyword(message);
  // Kata kunci yang sama-sama cocok sering ambigu -> tanya model.
  if (byKeyword && !isAmbiguous(message, byKeyword)) return byKeyword;
  if (!providers.isLive()) return byKeyword || 'customer_service';

  try {
    const result = await providers.chat({
      messages: [
        { role: 'system', content: prompts.router() },
        { role: 'user', content: message },
      ],
      temperature: 0,
      maxTokens: 40,
    });
    const match = /"agent"\s*:\s*"(\w+)"/.exec(result.content || '');
    if (match && AGENTS[match[1]]) return match[1];
  } catch (err) {
    logger.debug('router LLM gagal, pakai kata kunci:', err.message);
  }
  return byKeyword || 'customer_service';
}

function isAmbiguous(message, chosen) {
  const text = String(message).toLowerCase();
  const others = Object.keys(STRONG_SIGNALS).filter((k) => k !== chosen && STRONG_SIGNALS[k].test(text));
  return others.length > 0;
}

// ---------------------------------------------------------------------------
// Mode live: loop function calling
// ---------------------------------------------------------------------------

async function runAgent({ agentKey, history, message, ctx }) {
  const agent = AGENTS[agentKey];
  const tr = (key, vars) => demoTr(ctx && ctx.lang, key, vars);
  const messages = [
    { role: 'system', content: prompts[agentKey](ctx) },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: message },
  ];
  const definitions = tools.getDefinitions(agent.tools);
  const actions = [];
  const maxSteps = config.ai.maxSteps;

  for (let step = 0; step < maxSteps; step += 1) {
    const turn = await providers.chat({ messages, tools: definitions });
    const calls = turn.toolCalls || [];

    if (!calls.length) {
      return { reply: turn.content || tr('noAnswer'), actions, provider: turn.provider, model: turn.model };
    }

    messages.push({ role: 'assistant', content: turn.content || '', toolCalls: calls });
    for (const call of calls) {
      staff.setWorking(agent.staffId, `Menjalankan ${call.name}`, { autoIdleMs: 0, log: false });
      const result = await tools.execute(call.name, call.args, ctx);
      actions.push({ tool: call.name, args: call.args, result });
      messages.push({
        role: 'tool',
        toolCallId: call.id,
        name: call.name,
        content: JSON.stringify(result ?? {}),
      });
    }
  }
  return {
    reply: tr('tooManySteps'),
    actions, provider: null, model: null,
  };
}

// ---------------------------------------------------------------------------
// Mode demo: aturan sederhana, tanpa LLM
// ---------------------------------------------------------------------------

async function pickProduct(message) {
  const found = await products.findByName(message);
  if (found) return { exact: found, alternatives: [] };
  return { exact: null, alternatives: await products.search(message, 3) };
}

async function runDemoAgent({ agentKey, message, ctx }) {
  const text = message.toLowerCase();
  const actions = [];
  const tr = (key, vars) => demoTr(ctx && ctx.lang, key, vars);
  const demoNote = tr('demoNote');
  const { exact, alternatives } = await pickProduct(message);

  const describeAlternatives = alternatives.length
    ? tr('maybeMeant', { items: alternatives.map((p) => p.name).join(', ') })
    : '';

  if (agentKey === 'finance') {
    if (/tren|minggu|7 hari|grafik|trend|week|7 days|chart/.test(text)) {
      const trend = await reports.trend({ days: 7 });
      actions.push({ tool: 'sales_trend', args: { days: 7 }, result: trend });
      const total = trend.series.reduce((s, r) => s + r.revenue, 0);
      const profit = trend.series.reduce((s, r) => s + r.profit, 0);
      return tr('trend', { from: trend.from, to: trend.to, revenue: rupiah(total), profit: rupiah(profit) }) + demoNote;
    }
    const report = await reports.daily();
    actions.push({ tool: 'daily_report', args: {}, result: report });
    const top = report.top_products.map((t) => `${t.name} (${t.qty})`).join(', ') || '-';
    return tr('dailyReport', {
      date: report.date,
      orders: report.orders,
      revenue: rupiah(report.revenue),
      cost: rupiah(report.cost),
      profit: rupiah(report.profit),
      top,
    }) + demoNote;
  }

  if (agentKey === 'marketing') {
    if (!exact) {
      return tr('promoAsk') + describeAlternatives + demoNote;
    }
    const result = await tools.execute('generate_promo_image', { product_name: exact.name }, ctx);
    actions.push({ tool: 'generate_promo_image', args: { product_name: exact.name }, result });
    return tr('promoDone', { name: exact.name }) + demoNote;
  }

  if (agentKey === 'inventory') {
    if (/hampir habis|menipis|low|kritis|habis|running out|almost out/.test(text)) {
      const low = await products.lowStock();
      actions.push({ tool: 'low_stock_report', args: {}, result: low });
      const body = low.length
        ? tr('lowStock', { items: low.map((p) => `${p.name} (${p.stock})`).join(', ') })
        : tr('lowStockClear');
      return body + demoNote;
    }
    if (/barang masuk|tambah stok|restock|\+\s*\d/.test(text) && exact) {
      const m = /\+?\s*(\d+)/.exec(text);
      const result = await tools.execute('update_stock', { product_name: exact.name, delta: Number(m[1]) }, ctx);
      actions.push({ tool: 'update_stock', args: { product_name: exact.name, delta: Number(m[1]) }, result });
      return (result.error || tr('stockUpdated', { name: exact.name, stock: result.stock })) + demoNote;
    }
  }

  // --- Customer Service & fallback ---
  const phoneMatch = /\+?\d[\d\s-]{8,}\d/.exec(message);
  const phone = phoneMatch ? phoneMatch[0] : undefined;
  const withoutPhone = phone ? text.replace(phoneMatch[0], ' ') : text;
  const orderMatch = /\b(\d{1,7})\b/.exec(withoutPhone);

  if (/status|pesanan|sudah|kirim|order/.test(text) && orderMatch) {
    const args = { order_id: Number(orderMatch[1]), phone };
    const result = await tools.execute('get_order_status', args, ctx);
    actions.push({ tool: 'get_order_status', args: { order_id: args.order_id }, result });
    if (result.error) return result.error + demoNote;
    return tr('orderStatus', {
      id: result.id,
      customer: result.customer_name || '-',
      status: result.status,
      total: rupiah(result.total),
    }) + demoNote;
  }

  if (/^(daftar|list|semua|apa saja|lihat|show|all|what|list)\b/.test(text) && /produk|barang|jual|product|item|sell/.test(text)) {
    const all = await products.list();
    actions.push({ tool: 'list_products', args: {}, result: all });
    const list = all.map((p) => `${p.name} — ${rupiah(p.price)} (stok ${p.stock})`).join('\n');
    return tr('productList', { list }) + demoNote;
  }

  if (exact) {
    const stockNote = exact.stock <= exact.low_stock_threshold
      ? tr('stockLow', { stock: exact.stock })
      : tr('stockOk', { stock: exact.stock });
    actions.push({ tool: 'check_stock', args: { product_name: exact.name }, result: exact });
    return tr('productLine', { name: exact.name, price: rupiah(exact.price) }) + stockNote + demoNote;
  }

  if (alternatives.length) {
    actions.push({ tool: 'search_products', args: { query: message }, result: alternatives });
    return tr('similar', { items: alternatives.map((p) => `${p.name} (${rupiah(p.price)})`).join(', ') }) + demoNote;
  }

  return tr('help') + demoNote;
}


// ---------------------------------------------------------------------------
// Titik masuk
// ---------------------------------------------------------------------------

/**
 * Proses satu pesan.
 * @param {object} input
 * @param {string} input.message
 * @param {Array}  [input.history] riwayat percakapan sebelumnya
 * @param {'owner'|'customer'} [input.role]
 * @param {string} [input.lang] bahasa jawaban: 'id' (default) atau 'en'
 * @param {object} [input.context] { channel, name, verifiedPhone }
 */
async function handle({ message, history = [], role = 'owner', lang, context = {} } = {}) {
  const text = String(message || '').trim();
  if (!text) {
    const err = new Error('Pesan tidak boleh kosong.');
    err.statusCode = 400;
    err.expose = true;
    throw err;
  }

  const ctx = { ...context, role, lang: prompts.normalizeLang(lang || context.lang) };
  const agentKey = await route(text, ctx);
  const agent = AGENTS[agentKey];
  const live = providers.isLive();

  return staff.withTask(agent.staffId, `Mengerjakan: ${text.slice(0, 60)}`, async () => {
    let outcome;
    if (live) {
      try {
        outcome = await runAgent({ agentKey, history, message: text, ctx });
      } catch (err) {
        // Semua provider habis -> turun ke mode demo daripada membiarkan pengguna tanpa jawaban.
        logger.warn('semua provider AI gagal, memakai mode demo:', err.message);
        outcome = { ...(await runDemoAgent({ agentKey, message: text, ctx })), provider: 'demo-fallback' };
      }
    } else {
      outcome = await runDemoAgent({ agentKey, message: text, ctx });
    }

    const actions = outcome.actions || [];
    const promo = actions.find((a) => a.tool === 'generate_promo_image' && a.result && (a.result.url || a.result.pngUrl));
    const created = actions
      .filter((a) => a.tool === 'create_order' && a.result && a.result.id)
      .map((a) => ({ id: a.result.id, total: a.result.total, customer: a.result.customer && a.result.customer.name }));

    return {
      reply: sanitizeReply(outcome.reply),
      agent: agentKey,
      staff: agentLabel(agent, ctx.lang),
      mode: outcome.provider === 'demo-fallback' ? 'demo-fallback' : (live ? 'live' : 'demo'),
      provider: outcome.provider || null,
      model: outcome.model || null,
      actions: actions.map((a) => ({ tool: a.tool, args: a.args })),
      orders: created,
      imageUrl: promo ? (promo.result.pngUrl || promo.result.url) : null,
      image: promo ? promo.result : null,
    };
  });
}

module.exports = { handle, route, runAgent, runDemoAgent, AGENTS, isLive: () => providers.isLive() };
