/* Runtime multi bahasa untuk seluruh halaman frontend (ID/EN).
   Pakai atribut di HTML: data-i18n, data-i18n-html, data-i18n-attr="atribut:key".
   Pakai I18N.t('key', { vars }) di JS. Pilihan bahasa disimpan di localStorage. */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'omnistaff_lang';
  var SUPPORTED = ['id', 'en'];
  var FALLBACK = 'id';
  var LOCALE = { id: 'id-ID', en: 'en-US' };

  var DICT = {
    id: {
      lang: {
        id: 'ID', en: 'EN',
        switcher: 'Pilih bahasa',
        idFull: 'Bahasa Indonesia',
        enFull: 'English',
      },
      common: {
        perPcs: '/ pcs',
        errorPrefix: 'Permintaan gagal ({status})',
        apiKeyPrompt: 'Masukkan API key (APP_API_KEY di file .env):',
      },
      landing: {
        pageTitle: 'Produk dan Pesanan',
        pageDescription: 'Lihat produk yang tersedia dan buat pesanan.',
        brandAria: 'Katalog produk',
        cart: 'Pesanan',
        cartAria: 'Lihat rincian pesanan',
        kickerCatalog: 'KATALOG',
        heading: 'Produk tersedia',
        headingSub: 'Pilih produk untuk melihat rincian dan mengirim pesanan.',
        listTitle: 'Daftar produk',
        loading: 'Memuat produk…',
        searchLabel: 'Cari produk',
        searchPlaceholder: 'Cari produk…',
        filterAria: 'Filter kategori',
        kickerSummary: 'RINCIAN',
        orderTitle: 'Pesanan Anda',
        emptyCart: 'Keranjang masih kosong.',
        totalLabel: 'Total pesanan',
        customerInfo: 'Informasi pemesan',
        fieldName: 'Nama',
        fieldPhone: 'Nomor telepon / WhatsApp',
        fieldNote: 'Catatan',
        fieldNoteOptional: '(opsional)',
        fieldNotePlaceholder: 'Catatan untuk pesanan',
        paymentMethod: 'Metode pembayaran',
        paymentPayLater: 'Pesan, bayar saat konfirmasi',
        paymentPaypal: 'PayPal (USD)',
        paypalConversion: 'Estimasi tagihan PayPal: {amount}. Nominal akhir ditampilkan oleh PayPal.',
        paypalStarting: 'Menghubungkan ke PayPal…',
        paypalProcessing: 'Memverifikasi pembayaran PayPal…',
        paypalCancelled: 'Pembayaran PayPal dibatalkan.',
        paypalFailed: 'Pembayaran belum dapat diverifikasi. Periksa akun PayPal sebelum mencoba lagi.',
        submitOrder: 'Buat pesanan',
        cartAriaOpen: 'Buka layanan pelanggan',
        csAria: 'Live customer service',
        csName: 'Sari · Customer Service',
        csConnecting: 'menghubungkan…',
        csReset: 'Mulai ulang percakapan',
        csClose: 'Tutup chat',
        csSuggestionsAria: 'Saran pertanyaan',
        csFieldPlaceholder: 'Tanya produk atau pesanan…',
        csFieldAria: 'Pesan untuk customer service',
        csSendAria: 'Kirim pesan',
        csFoot: 'Sesi chat tersimpan di browser ini.',
        altAll: 'Semua',
        altOther: 'Lainnya',
        productCount: '{shown} dari {total} produk',
        noMatch: 'Tidak ada produk yang cocok.',
        inStock: 'Tersedia',
        outOfStock: 'Stok habis',
        addToOrder: 'Tambah ke pesanan',
        unavailable: 'Tidak tersedia',
        maxQty: 'Maksimal {max} pcs untuk satu produk.',
        itemCount: '{count} item',
        qtyAria: 'Jumlah {name}',
        qtyMinusAria: 'Kurangi {name}',
        qtyPlusAria: 'Tambah {name}',
        posterAlt: 'Poster {name}',
        sending: 'Mengirim pesanan…',
        orderFailed: 'Pesanan gagal dikirim. Coba lagi.',
        orderUnprocessable: 'Pesanan tidak dapat diproses.',
        catalogFailed: 'Katalog tidak dapat dimuat. Muat ulang halaman.',
        receiptTitle: 'Pesanan berhasil dikirim',
        receiptAwaiting: 'Menunggu konfirmasi',
        receiptPaid: 'Lunas',
        receiptCustomer: 'Pemesan',
        receiptStatus: 'Status',
        receiptTotal: 'Total',
        aiOnline: 'AI online',
        aiDemo: 'Mode demo',
        serverOffline: 'server offline',
        aiKeyHint: 'Isi API key di .env untuk AI penuh',
        aiModelActive: 'Model aktif: {provider}',
      },
      cs: {
        who: 'Sari · CS AI',
        typing: 'mengetik…',
        requestFailed: 'Permintaan gagal ({status}). Coba lagi sebentar lagi.',
        connectionProblem: 'koneksi bermasalah',
        noAnswer: 'Maaf, saya belum bisa menjawab itu.',
        orderRecorded: 'Pesanan #{id} tercatat — total {total}.',
        connectionLost: 'Koneksi ke server terputus. Coba lagi ya.',
        available24: 'tersedia 24 jam',
        demoMode: 'mode demo (tanpa AI)',
        offline: 'terputus',
        greeting1: 'Halo! 👋 Saya Sari, asisten virtual toko ini.',
        greeting2: 'Tanya saja soal produk, harga, atau mau pesan. Saya siap 24 jam.',
        posterAlt: 'Poster produk',
      },
      dashboard: {
        pageTitle: 'OmniStaff AI — Kantor Virtual UMKM',
        subtitle: 'Empat staf virtual yang bekerja untuk tokomu',
        openChat: 'Buka chat & suara',
        officeAria: 'Kantor virtual 3D',
        officeImgAria: 'Kantor virtual 3D dengan empat staf AI',
        stageHint: 'Seret untuk memutar kantor, gulir untuk zoom.',
        today: 'Hari ini',
        orders: 'pesanan',
        revenue: 'omzet',
        profit: 'laba',
        staff: 'Staf',
        channels: 'Kanal pelanggan',
        command: 'Beri perintah',
        commandPlaceholder: 'Contoh: stok kopi robusta',
        commandAria: 'Perintah untuk staf',
        send: 'Kirim',
        working: 'Staf sedang bekerja…',
        notEnabled: 'belum diaktifkan',
        active: 'aktif ({state})',
        activeWebhook: 'aktif (webhook)',
        promoAlt: 'Poster promosi hasil buatan staf',
        officeFailed: 'Three.js gagal dimuat. Periksa koneksi internet.',
      },
      chat: {
        pageTitle: 'OmniStaff AI — Chat & Suara',
        heading: 'Chat & perintah suara',
        subtitle: 'Tanya stok, buat pesanan, minta laporan atau poster',
        back: 'Kembali ke kantor',
        greeting: 'Halo! Coba ketik atau ucapkan: "stok kopi robusta", "laporan hari ini", atau "buatkan poster keripik pisang".',
        greetWho: 'OmniStaff',
        speak: 'Bacakan jawaban',
        talk: 'Bicara',
        talkAria: 'Bicara dengan suara',
        typePlaceholder: 'Ketik pesan…',
        messageAria: 'Pesan',
        send: 'Kirim',
        working: 'Staf sedang bekerja…',
        unsupported: 'Browser ini belum mendukung suara. Gunakan Chrome atau Edge.',
        listening: 'Mendengarkan…',
        micFailed: 'Mikrofon gagal ({reason}). Periksa izin mikrofon.',
        system: 'Sistem',
        posterAlt: 'Poster promosi',
      },
    },

    en: {
      lang: {
        id: 'ID', en: 'EN',
        switcher: 'Choose language',
        idFull: 'Bahasa Indonesia',
        enFull: 'English',
      },
      common: {
        perPcs: '/ pc',
        errorPrefix: 'Request failed ({status})',
        apiKeyPrompt: 'Enter your API key (APP_API_KEY in the .env file):',
      },
      landing: {
        pageTitle: 'Products and Orders',
        pageDescription: 'Browse the available products and place an order.',
        brandAria: 'Product catalog',
        cart: 'Cart',
        cartAria: 'View order details',
        kickerCatalog: 'CATALOG',
        heading: 'Available products',
        headingSub: 'Pick a product to see the details and place an order.',
        listTitle: 'Product list',
        loading: 'Loading products…',
        searchLabel: 'Search products',
        searchPlaceholder: 'Search products…',
        filterAria: 'Filter by category',
        kickerSummary: 'SUMMARY',
        orderTitle: 'Your order',
        emptyCart: 'Your cart is empty.',
        totalLabel: 'Order total',
        customerInfo: 'Customer information',
        fieldName: 'Name',
        fieldPhone: 'Phone number / WhatsApp',
        fieldNote: 'Note',
        fieldNoteOptional: '(optional)',
        fieldNotePlaceholder: 'Note for your order',
        paymentMethod: 'Payment method',
        paymentPayLater: 'Place order, pay when confirmed',
        paymentPaypal: 'PayPal (USD)',
        paypalConversion: 'Estimated PayPal charge: {amount}. PayPal will show the final amount.',
        paypalStarting: 'Connecting to PayPal…',
        paypalProcessing: 'Verifying PayPal payment…',
        paypalCancelled: 'PayPal payment was cancelled.',
        paypalFailed: 'The payment could not be verified. Check your PayPal account before trying again.',
        submitOrder: 'Place order',
        cartAriaOpen: 'Open customer service',
        csAria: 'Live customer service',
        csName: 'Sari · Customer Service',
        csConnecting: 'connecting…',
        csReset: 'Restart the conversation',
        csClose: 'Close chat',
        csSuggestionsAria: 'Suggested questions',
        csFieldPlaceholder: 'Ask about products or orders…',
        csFieldAria: 'Message to customer service',
        csSendAria: 'Send message',
        csFoot: 'This chat session is saved in your browser.',
        altAll: 'All',
        altOther: 'Other',
        productCount: '{shown} of {total} products',
        noMatch: 'No products match your search.',
        inStock: 'Available',
        outOfStock: 'Out of stock',
        addToOrder: 'Add to order',
        unavailable: 'Unavailable',
        maxQty: 'Maximum {max} pcs per product.',
        itemCount: '{count} items',
        qtyAria: 'Quantity of {name}',
        qtyMinusAria: 'Decrease {name}',
        qtyPlusAria: 'Increase {name}',
        posterAlt: '{name} poster',
        sending: 'Sending order…',
        orderFailed: 'The order could not be sent. Please try again.',
        orderUnprocessable: 'Your order could not be processed.',
        catalogFailed: 'The catalog could not be loaded. Please reload the page.',
        receiptTitle: 'Order sent successfully',
        receiptAwaiting: 'Awaiting confirmation',
        receiptPaid: 'Paid',
        receiptCustomer: 'Customer',
        receiptStatus: 'Status',
        receiptTotal: 'Total',
        aiOnline: 'AI online',
        aiDemo: 'Demo mode',
        serverOffline: 'server offline',
        aiKeyHint: 'Add an API key in .env for full AI',
        aiModelActive: 'Active model: {provider}',
      },
      cs: {
        who: 'Sari · AI CS',
        typing: 'typing…',
        requestFailed: 'Request failed ({status}). Please try again in a moment.',
        connectionProblem: 'connection problem',
        noAnswer: "Sorry, I can't answer that yet.",
        orderRecorded: 'Order #{id} recorded — total {total}.',
        connectionLost: 'The connection to the server was lost. Please try again.',
        available24: 'available 24 hours',
        demoMode: 'demo mode (no AI)',
        offline: 'disconnected',
        greeting1: "Hi! 👋 I'm Sari, this store's virtual assistant.",
        greeting2: "Ask me about products, prices, or place an order. I'm available 24 hours.",
        posterAlt: 'Product poster',
      },
      dashboard: {
        pageTitle: 'OmniStaff AI — Virtual Office for MSMEs',
        subtitle: 'Four virtual staff working for your store',
        openChat: 'Open chat & voice',
        officeAria: '3D virtual office',
        officeImgAria: '3D virtual office with four AI staff',
        stageHint: 'Drag to rotate the office, scroll to zoom.',
        today: 'Today',
        orders: 'orders',
        revenue: 'revenue',
        profit: 'profit',
        staff: 'Staff',
        channels: 'Customer channels',
        command: 'Give a command',
        commandPlaceholder: 'Example: kopi robusta stock',
        commandAria: 'Command for the staff',
        send: 'Send',
        working: 'Staff is working…',
        notEnabled: 'not enabled yet',
        active: 'active ({state})',
        activeWebhook: 'active (webhook)',
        promoAlt: 'Promotional poster made by the staff',
        officeFailed: 'Three.js failed to load. Check your internet connection.',
      },
      chat: {
        pageTitle: 'OmniStaff AI — Chat & Voice',
        heading: 'Chat & voice commands',
        subtitle: 'Ask about stock, place orders, request reports or posters',
        back: 'Back to the office',
        greeting: "Hi! Try typing or saying: \"kopi robusta stock\", \"today's report\", or \"make a poster for banana chips\".",
        greetWho: 'OmniStaff',
        speak: 'Read replies aloud',
        talk: 'Talk',
        talkAria: 'Speak with your voice',
        typePlaceholder: 'Type a message…',
        messageAria: 'Message',
        send: 'Send',
        working: 'Staff is working…',
        unsupported: "This browser doesn't support voice yet. Use Chrome or Edge.",
        listening: 'Listening…',
        micFailed: 'Microphone failed ({reason}). Check the microphone permission.',
        system: 'System',
        posterAlt: 'Promotional poster',
      },
    },
  };

  var listeners = [];
  var switchers = [];
  var lang = resolveInitialLang();

  function readStorage() {
    try { return global.localStorage.getItem(STORAGE_KEY); } catch (err) { return null; }
  }

  function writeStorage(value) {
    try { global.localStorage.setItem(STORAGE_KEY, value); } catch (err) { /* storage diblokir */ }
  }

  function resolveInitialLang() {
    var saved = readStorage();
    if (SUPPORTED.indexOf(saved) !== -1) return saved;
    var nav = '';
    try {
      nav = (global.navigator && (navigator.language || (navigator.languages && navigator.languages[0]))) || '';
    } catch (err) { nav = ''; }
    var base = String(nav).toLowerCase().split('-')[0];
    return SUPPORTED.indexOf(base) !== -1 ? base : FALLBACK;
  }

  function lookup(table, key) {
    var parts = String(key).split('.');
    for (var i = 0; i < parts.length; i += 1) {
      if (table == null) return undefined;
      table = table[parts[i]];
    }
    return table;
  }

  function interpolate(template, vars) {
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, function (match, name) {
      return vars[name] == null ? match : String(vars[name]);
    });
  }

  function t(key, vars) {
    var value = lookup(DICT[lang], key);
    if (typeof value !== 'string') value = lookup(DICT[FALLBACK], key);
    if (typeof value !== 'string') return key;
    return interpolate(value, vars);
  }

  function locale() { return LOCALE[lang] || LOCALE[FALLBACK]; }

  function number(value) { return Number(value || 0).toLocaleString(locale()); }

  function rupiah(value) { return 'Rp' + number(value); }

  function applyAttrSpec(el, spec) {
    spec.split(/\s+/).forEach(function (pair) {
      var idx = pair.indexOf(':');
      if (idx < 1) return;
      el.setAttribute(pair.slice(0, idx), t(pair.slice(idx + 1)));
    });
  }

  function readVars(el) {
    var raw = el.dataset.i18nVars;
    if (!raw) return undefined;
    try { return JSON.parse(raw); } catch (err) { return undefined; }
  }

  function apply(root) {
    var scope = root || global.document;
    if (!scope || !scope.querySelectorAll) return;
    scope.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.dataset.i18n, readVars(el));
    });
    scope.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      el.innerHTML = t(el.dataset.i18nHtml, readVars(el));
    });
    scope.querySelectorAll('[data-i18n-attr]').forEach(function (el) { applyAttrSpec(el, el.dataset.i18nAttr); });
  }

  function renderSwitchers() {
    switchers.forEach(function (host) {
      host.setAttribute('aria-label', t('lang.switcher'));
      host.querySelectorAll('[data-lang]').forEach(function (btn) {
        var code = btn.dataset.lang;
        btn.textContent = t('lang.' + code);
        btn.title = t('lang.' + code + 'Full');
        btn.setAttribute('aria-pressed', String(code === lang));
      });
    });
  }

  function mountSwitchers(root) {
    var scope = root || global.document;
    if (!scope || !scope.querySelectorAll) return;
    scope.querySelectorAll('[data-lang-switch]').forEach(function (host) {
      host.classList.add('lang-switch');
      host.setAttribute('role', 'group');
      SUPPORTED.forEach(function (code) {
        var btn = global.document.createElement('button');
        btn.type = 'button';
        btn.className = 'lang-option';
        btn.dataset.lang = code;
        btn.addEventListener('click', function () { setLang(code); });
        host.appendChild(btn);
      });
      if (switchers.indexOf(host) === -1) switchers.push(host);
    });
    renderSwitchers();
  }

  function setLang(next) {
    if (SUPPORTED.indexOf(next) === -1 || next === lang) return lang;
    lang = next;
    writeStorage(lang);
    global.document.documentElement.lang = locale();
    apply();
    renderSwitchers();
    var detail = { lang: lang, locale: locale() };
    listeners.slice().forEach(function (fn) {
      try { fn(detail); } catch (err) { /* satu listener gagal tidak boleh menghentikan yang lain */ }
    });
    try {
      global.document.dispatchEvent(new global.CustomEvent('omnistaff:langchange', { detail: detail }));
    } catch (err) { /* CustomEvent tidak tersedia */ }
    return lang;
  }

  function onLangChange(fn) {
    if (typeof fn === 'function') listeners.push(fn);
    return function off() {
      var idx = listeners.indexOf(fn);
      if (idx !== -1) listeners.splice(idx, 1);
    };
  }

  global.I18N = {
    lang: function () { return lang; },
    locale: locale,
    t: t,
    number: number,
    rupiah: rupiah,
    apply: apply,
    mountSwitchers: mountSwitchers,
    setLang: setLang,
    onLangChange: onLangChange,
    supported: SUPPORTED.slice(),
  };

  function boot() {
    global.document.documentElement.lang = locale();
    apply();
    mountSwitchers();
  }

  if (global.document.readyState === 'loading') global.document.addEventListener('DOMContentLoaded', boot);
  else boot();
}(window));
