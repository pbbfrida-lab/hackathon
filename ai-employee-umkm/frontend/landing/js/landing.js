/* Landing page: isi fitur, tim, katalog, dan FAQ dari data server. */
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const t = (key, vars) => window.I18N.t(key, vars);
  const rupiah = (n) => window.I18N.rupiah(n);

  const FEATURES = [
    { icon: '💬', title: 'Layanan pelanggan 24 jam', desc: 'Menjawab pertanyaan harga, ketersediaan, dan status pesanan kapan saja tanpa menunggu pemilik.', tags: ['Telegram', 'Web', 'WhatsApp'] },
    { icon: '📦', title: 'Stok akurat otomatis', desc: 'Setiap pesanan langsung mengurangi stok. Produk yang menyentuh batas minimum diperingatkan lebih dulu.', tags: ['anti minus', 'barang masuk'] },
    { icon: '🧾', title: 'Pesanan tercatat rapi', desc: 'Nama, produk, jumlah, dan total tersimpan dengan rincian modal sehingga laba bisa dihitung.', tags: ['transaksi', 'riwayat'] },
    { icon: '📈', title: 'Laporan harian otomatis', desc: 'Omzet, modal, laba, dan produk terlaris dihitung dari data pesanan, bukan dicatat manual.', tags: ['omzet', 'laba', 'terlaris'] },
    { icon: '🎨', title: 'Poster promosi instantly', desc: 'Minta poster lewat chat, staf AI langsung membuat desain siap tayang untuk produk pilihan.', tags: ['desain', 'konten'] },
    { icon: '🎤', title: 'Perintah suara', desc: 'Pengunjung bisa bertanya dengan suara lewat mikrofon, diterjemahkan menjadi teks lalu dijawab.', tags: ['suara', 'STT'] },
    { icon: '🔒', title: 'Data tetap milik Anda', desc: 'Semua transaksi disimpan di MySQL milik sendiri. Tidak ada data yang dikirim ke pihak ketiga.', tags: ['self-hosted'] },
    { icon: '🧠', title: 'Empat staf spesialis', desc: 'Router memilih staf paling cocok untuk tiap pertanyaan, jadi konteks tidak pernah tertukar.', tags: ['multi-agent'] },
  ];

  const STAFF_COLORS = [
    'linear-gradient(135deg,#7c5cff,#a78bfa)',
    'linear-gradient(135deg,#22d3ee,#0ea5e9)',
    'linear-gradient(135deg,#f5b544,#f97316)',
    'linear-gradient(135deg,#34d399,#10b981)',
  ];

  const FAQS = [
    { q: 'Apakah benar-benar gratis?', a: 'Ya. Semua AI yang dipakai punya free tier resmi: Groq, Google AI Studio (Gemini), dan Freebuff. Tidak ada biaya langganan. kuota free tier-nya terbatas, jadi sistem kami membatasi jumlah pesan otomatis.' },
    { q: 'Apakah data pelanggan saya aman?', a: 'Semua data disimpan di MySQL milik server Anda sendiri. Untuk live chat di halaman ini, pengunjung hanya boleh bertanya soal produk dan membuat pesanan — mereka tidak bisa melihat laporan keuangan, modal, atau data pelanggan lain.' },
    { q: 'Bisakah lewat Telegram?', a: 'Bisa, dan itu cara paling mudah. Buat bot lewat @BotFather, masukkan tokennya ke file .env, lalu kirim /id ke bot untuk mendaftarkan diri sebagai pemilik. Tidak perlu URL publik karena memakai long polling.' },
    { q: 'Kalau produknya banyak, masih kuat?', a: 'Pencarian produk memakai pencocokan nama bertahap, jadi "stok kopi robusta" tetap menemukan produk yang tepat meski katalog berisi ratusan item. Pesanan besar otomatis mengunci baris stok agar tidak terjual dua kali.' },
    { q: 'Apakah bisa dipakai untuk produk yang berbeda?', a: 'Bisa. Semua produk, harga, dan deskripsi dibaca langsung dari database, jadi katalog di halaman ini selalu sama dengan yang dilihat staf AI.' },
  ];

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  // ---------- Fitur ----------
  function renderFeatures() {
    const grid = $('#fiturGrid');
    if (!grid) return;
    grid.innerHTML = FEATURES.map((f) => `
      <article class="card reveal">
        <div class="feat-icon" aria-hidden="true">${f.icon}</div>
        <h3>${escapeHtml(f.title)}</h3>
        <p>${escapeHtml(f.desc)}</p>
        <ul class="feat-tags">${f.tags.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
      </article>`).join('');
  }

  // ---------- Tim AI ----------
  function renderStaff(list) {
    const grid = $('#timGrid');
    if (!grid || !list || !list.length) return;
    grid.innerHTML = list.map((s, i) => `
      <article class="card staff-card reveal">
        <div class="staff-face" style="background:${STAFF_COLORS[i % STAFF_COLORS.length]}">${escapeHtml(s.name.charAt(0))}</div>
        <div class="staff-role">${escapeHtml(s.role)}</div>
        <h3>${escapeHtml(s.name)}</h3>
        <p>${escapeHtml((s.skills || []).join(' · '))}</p>
        <span class="staff-status"><i class="dot online"></i>Online, siap bekerja</span>
      </article>`).join('');
    observeReveals();
  }

  // ---------- FAQ ----------
  function renderFaq() {
    const list = $('#faqList');
    if (!list) return;
    list.innerHTML = FAQS.map((f) => `
      <details class="reveal">
        <summary>${escapeHtml(f.q)}</summary>
        <p>${escapeHtml(f.a)}</p>
      </details>`).join('');
  }

  // ---------- Katalog ----------
  const state = { products: [], filter: 'all', search: '', cart: new Map(), order: null, status: null, paypal: null, paypalOrderId: null, paypalBusy: false };
  const MAX_QTY_PER_PRODUCT = 20;
  const PRODUCT_PROMOTIONS = new Map([
    ['kopi robusta lampung 250g', '/assets/promotions/promo-1790581378127.png'],
  ]);

  function setStatus(key, vars) {
    state.status = key ? { key, vars } : null;
    const box = $('#checkoutStatus');
    if (box) box.textContent = key ? t(key, vars) : '';
  }

  function checkoutPayload() {
    const formData = new FormData($('#checkoutForm'));
    return {
      name: formData.get('name'),
      phone: formData.get('phone'),
      note: formData.get('note'),
      items: [...state.cart.entries()].map(([productId, qty]) => ({ productId, qty })),
    };
  }

  async function paypalRequest(path, body) {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-omnistaff-lang': window.I18N.lang() },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || t('landing.paypalFailed'));
    return payload;
  }

  function updatePaymentMethod() {
    const isPayPal = $('#paymentMethod') && $('#paymentMethod').value === 'paypal';
    if ($('#paymentMethod')) $('#paymentMethod').disabled = state.paypalBusy;
    $('#checkoutButton').hidden = Boolean(isPayPal);
    $('#paypalButtons').hidden = !isPayPal || !state.paypal;
    $('#paypalConversion').hidden = !isPayPal || !state.paypal;
  }

  function setPayPalBusy(busy) {
    state.paypalBusy = busy;
    document.querySelectorAll('#checkoutForm input, #checkoutForm textarea, #checkoutForm select')
      .forEach((field) => { field.disabled = busy; });
    document.querySelectorAll('.quantity-control button')
      .forEach((button) => { button.disabled = busy; });
    document.querySelectorAll('.add-button')
      .forEach((button) => { button.disabled = busy || !button.dataset.available; });
    updatePaymentMethod();
    renderCart();
  }

  async function loadPayPal() {
    try {
      const response = await fetch('/api/public/paypal/config');
      const config = await response.json();
      if (!response.ok || !config.enabled || !config.clientId || !(config.idrPerUsd > 0)) return;

      state.paypal = config;
      if (!window.paypal) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(config.clientId)}&currency=USD&intent=capture`;
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      const buttons = window.paypal.Buttons({
        createOrder: async () => {
          const form = $('#checkoutForm');
          if (!form.reportValidity()) throw new Error('Checkout details are incomplete.');
          const orderPayload = checkoutPayload();
          setPayPalBusy(true);
          setStatus('landing.paypalStarting');
          try {
            const payload = await paypalRequest('/api/public/paypal/orders', orderPayload);
            state.paypalOrderId = payload.paypalOrderId;
            return payload.paypalOrderId;
          } catch (error) {
            setPayPalBusy(false);
            setStatus('landing.paypalFailed');
            throw error;
          }
        },
        onApprove: async (data) => {
          state.paypalOrderId = data.orderID;
          setStatus('landing.paypalProcessing');
          try {
            const payload = await paypalRequest('/api/public/paypal/capture', { paypalOrderId: data.orderID });
            state.paypalOrderId = null;
            setPayPalBusy(false);
            state.cart.clear();
            $('#checkoutForm').reset();
            updatePaymentMethod();
            renderCart();
            setStatus(null);
            state.order = payload.order;
            renderReceipt(payload.order);
          } catch (error) {
            setPayPalBusy(false);
            setStatus('landing.paypalFailed');
          }
        },
        onCancel: async (data) => {
          state.paypalOrderId = data.orderID;
          try {
            await paypalRequest('/api/public/paypal/cancel', { paypalOrderId: data.orderID });
            state.paypalOrderId = null;
            setPayPalBusy(false);
            setStatus('landing.paypalCancelled');
          } catch (error) {
            setPayPalBusy(false);
            setStatus('landing.paypalFailed');
          }
        },
        onError: async () => {
          if (state.paypalOrderId) {
            await paypalRequest('/api/public/paypal/cancel', { paypalOrderId: state.paypalOrderId }).catch(() => {});
            state.paypalOrderId = null;
          }
          setPayPalBusy(false);
          setStatus('landing.paypalFailed');
        },
      });
      if (!buttons.isEligible()) return;
      await buttons.render('#paypalButtons');
      $('#paymentMethodField').hidden = false;
      updatePaymentMethod();
      renderCart();
    } catch (error) {
      state.paypal = null;
    }
  }

  function categories(products) {
    const map = new Map();
    for (const p of products) {
      const key = (p.name || '').split(/\s+/)[0] || t('landing.altOther');
      map.set(key, (map.get(key) || 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }

  function renderFilters() {
    const box = $('#catalogFilters');
    if (!box) return;
    const cats = categories(state.products);
    box.innerHTML = `<button class="chip" data-cat="all" aria-pressed="${state.filter === 'all'}">${escapeHtml(t('landing.altAll'))}</button>`
      + cats.map(([name, n]) => `<button class="chip" data-cat="${escapeHtml(name)}" aria-pressed="${state.filter === name}">${escapeHtml(name)} (${n})</button>`).join('');
    box.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        state.filter = chip.dataset.cat;
        renderFilters();
        renderProducts();
      });
    });
  }

  function renderProducts() {
    const grid = $('#catalogGrid');
    if (!grid) return;
    const term = state.search.toLowerCase();
    const rows = state.products.filter((p) => {
      const inCat = state.filter === 'all' || (p.name || '').toLowerCase().startsWith(state.filter.toLowerCase());
      const inSearch = !term || (p.name || '').toLowerCase().includes(term) || (p.description || '').toLowerCase().includes(term);
      return inCat && inSearch;
    });
    const count = $('#productCount');
    if (count) count.textContent = t('landing.productCount', { shown: rows.length, total: state.products.length });
    if (!rows.length) {
      grid.innerHTML = `<p class="empty-state">${escapeHtml(t('landing.noMatch'))}</p>`;
      return;
    }
    grid.innerHTML = rows.map((p) => `
      <article class="product-card">
        ${PRODUCT_PROMOTIONS.has((p.name || '').trim().toLowerCase())
          ? `<img class="product-image" src="${PRODUCT_PROMOTIONS.get((p.name || '').trim().toLowerCase())}" alt="${escapeHtml(t('landing.posterAlt', { name: p.name }))}" loading="lazy">`
          : ''}
        <div class="product-card-top">
          <span class="stock-tag ${p.stock_available ? 'in' : 'out'}">${p.stock_available ? t('landing.inStock') : t('landing.outOfStock')}</span>
          <span class="product-price">${rupiah(p.price)}</span>
        </div>
        <h3>${escapeHtml(p.name)}</h3>
        <p class="product-desc">${escapeHtml(p.description || ' ')}</p>
        <button class="add-button" type="button" data-add="${Number(p.id)}" data-available="${p.stock_available ? '1' : ''}" ${p.stock_available && !state.paypalBusy ? '' : 'disabled'}>
          ${p.stock_available ? t('landing.addToOrder') : t('landing.unavailable')}
        </button>
      </article>`).join('');
    grid.querySelectorAll('[data-add]').forEach((button) => {
      button.addEventListener('click', () => {
        if (state.paypalBusy) return;
        const productId = Number(button.dataset.add);
        const quantity = state.cart.get(productId) || 0;
        if (quantity >= MAX_QTY_PER_PRODUCT) {
          setStatus('landing.maxQty', { max: MAX_QTY_PER_PRODUCT });
          return;
        }
        state.cart.set(productId, quantity + 1);
        setStatus(null);
        renderCart();
      });
    });
  }

  function renderCart() {
    const list = $('#cartItems');
    if (!list) return;
    const rows = [...state.cart.entries()].map(([id, qty]) => ({
      product: state.products.find((item) => Number(item.id) === id), qty,
    })).filter((item) => item.product);
    const count = rows.reduce((sum, item) => sum + item.qty, 0);
    const total = rows.reduce((sum, item) => sum + Number(item.product.price) * item.qty, 0);
    $('#cartCount').textContent = count;
    $('#orderItemCount').textContent = t('landing.itemCount', { count });
    $('#cartTotal').textContent = rupiah(total);
    $('#checkoutButton').disabled = count === 0 || state.paypalBusy;
    if (state.paypal) {
      const usd = Math.round((total / state.paypal.idrPerUsd) * 100) / 100;
      const amount = new Intl.NumberFormat(window.I18N.locale(), { style: 'currency', currency: 'USD' }).format(usd);
      $('#paypalConversion').textContent = t('landing.paypalConversion', { amount });
    }

    if (!rows.length) {
      list.innerHTML = `<p class="empty-state">${escapeHtml(t('landing.emptyCart'))}</p>`;
      return;
    }
    list.innerHTML = rows.map(({ product, qty }) => `
      <article class="cart-row">
        <div class="cart-row-info">
          <h3>${escapeHtml(product.name)}</h3>
          <span>${rupiah(product.price)} ${escapeHtml(t('common.perPcs'))}</span>
          <strong>${rupiah(Number(product.price) * qty)}</strong>
        </div>
        <div class="quantity-control" aria-label="${escapeHtml(t('landing.qtyAria', { name: product.name }))}">
          <button type="button" data-change="-1" data-id="${Number(product.id)}" aria-label="${escapeHtml(t('landing.qtyMinusAria', { name: product.name }))}">−</button>
          <span>${qty}</span>
          <button type="button" data-change="1" data-id="${Number(product.id)}" aria-label="${escapeHtml(t('landing.qtyPlusAria', { name: product.name }))}">+</button>
        </div>
      </article>`).join('');
  }

  function renderReceipt(order) {
    const receipt = $('#orderReceipt');
    const status = order.status === 'pending' ? t('landing.receiptAwaiting')
      : order.status === 'paid' ? t('landing.receiptPaid') : order.status;
    receipt.innerHTML = `
      <div class="receipt-heading"><span>${escapeHtml(t('landing.receiptTitle'))}</span><h3>Pesanan #${escapeHtml(order.id)}</h3></div>
      <dl class="receipt-details">
        <div><dt>${escapeHtml(t('landing.receiptCustomer'))}</dt><dd>${escapeHtml(order.customer || '')}</dd></div>
        <div><dt>${escapeHtml(t('landing.receiptStatus'))}</dt><dd>${escapeHtml(status)}</dd></div>
      </dl>
      <ul class="receipt-items">${(order.items || []).map((item) => `
        <li><span>${escapeHtml(item.name)} × ${Number(item.qty)}</span><strong>${rupiah(item.subtotal)}</strong></li>`).join('')}
      </ul>
      <div class="receipt-total"><span>${escapeHtml(t('landing.receiptTotal'))}</span><strong>${rupiah(order.total)}</strong></div>`;
    receipt.hidden = false;
    receipt.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function submitOrder(form) {
    if ($('#paymentMethod') && $('#paymentMethod').value === 'paypal') return;
    const button = $('#checkoutButton');
    const items = [...state.cart.entries()].map(([productId, qty]) => ({ productId, qty }));
    if (!items.length) return;

    button.disabled = true;
    setStatus('landing.sending');
    try {
      const response = await fetch('/api/public/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-omnistaff-lang': window.I18N.lang() },
        body: JSON.stringify(checkoutPayload()),
      });
      const payload = await response.json();
      if (!response.ok) {
        const message = payload.message || payload.error?.message || payload.error;
        throw new Error(typeof message === 'string' ? message : t('landing.orderUnprocessable'));
      }
      state.cart.clear();
      renderCart();
      form.reset();
      setStatus(null);
      state.order = payload.order;
      renderReceipt(payload.order);
    } catch (error) {
      setStatus('landing.orderFailed');
      button.disabled = state.cart.size === 0;
    }
  }

  async function loadCatalog() {
    try {
      const response = await fetch('/api/public/catalog', { headers: { 'x-omnistaff-lang': window.I18N.lang() } });
      if (!response.ok) throw new Error(t('landing.catalogFailed'));
      const data = await response.json();
      state.products = data.products || [];
      renderFilters();
      renderProducts();
      renderCart();
    } catch (err) {
      const grid = $('#catalogGrid');
      if (grid) grid.innerHTML = `<p class="muted">${escapeHtml(t('landing.catalogFailed'))}</p>`;
    }
  }

  async function loadStatus() {
    const dot = $('#aiBadge').querySelector('.dot');
    const text = $('#aiBadgeText');
    try {
      const s = await fetch('/api/public/status', { headers: { 'x-omnistaff-lang': window.I18N.lang() } }).then((r) => r.json());
      dot.className = 'dot ' + (s.ai_live ? 'online' : 'demo');
      text.textContent = s.ai_live ? t('landing.aiOnline') : t('landing.aiDemo');
      dot.parentElement.title = s.ai_live ? t('landing.aiModelActive', { provider: s.ai_provider }) : t('landing.aiKeyHint');
    } catch (err) {
      dot.className = 'dot off';
      text.textContent = t('landing.serverOffline');
    }
  }

  // ---------- Reveal on scroll ----------
  let observer = null;
  function observeReveals() {
    const items = document.querySelectorAll('.reveal:not(.in)');
    if (!('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('in'));
      return;
    }
    if (!observer) {
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px' });
    }
    items.forEach((el) => observer.observe(el));
  }

  function rerender() {
    renderFilters();
    renderProducts();
    renderCart();
    if (state.order) renderReceipt(state.order);
    if (state.status) setStatus(state.status.key, state.status.vars);
  }

  function init() {
    renderCart();
    loadCatalog();

    const search = $('#catalogSearch');
    if (search) {
      search.addEventListener('input', () => {
        state.search = search.value.trim();
        renderProducts();
      });
    }

    $('#cartItems').addEventListener('click', (event) => {
      if (state.paypalBusy) return;
      const button = event.target.closest('[data-change]');
      if (!button) return;
      const productId = Number(button.dataset.id);
      const next = (state.cart.get(productId) || 0) + Number(button.dataset.change);
      if (next <= 0) state.cart.delete(productId);
      else if (next <= MAX_QTY_PER_PRODUCT) state.cart.set(productId, next);
      else {
        setStatus('landing.maxQty', { max: MAX_QTY_PER_PRODUCT });
        return;
      }
      setStatus(null);
      renderCart();
    });

    $('#checkoutForm').addEventListener('submit', (event) => {
      event.preventDefault();
      submitOrder(event.currentTarget);
    });
    $('#paymentMethod').addEventListener('change', updatePaymentMethod);

    window.I18N.onLangChange(rerender);
    loadPayPal();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
