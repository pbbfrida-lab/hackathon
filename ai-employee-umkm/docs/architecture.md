# Arsitektur OmniStaff AI

```
Pengunjung (landing page + live CS)        Dashboard 3D (frontend/dashboard)
        │  /api/public/*                        │  /api/*  (X-API-Key opsional)
        │  peran dikunci 'customer'             │
        └──────────────┬─────────────────────────┘
                       ▼
Express (backend/server.js)
  ├─ /api/public/*  katalog, status, suggestions, live CS   (tanpa API key, ada rate limit)
  ├─ /api/ai/*      chat, voice, promo, health provider     (butuh X-API-Key)
  └─ /api/*         REST: produk, pesanan, pelanggan, laporan, staf
                       ▼
              ai/agent.js  (router staf → agen + tool loop)
                 ├─ ai/providers.js      Groq → Gemini → Freebuff (failover + cooldown)
                 ├─ ai/tools.js          satu-satunya jalan akses data dari AI
                 ├─ ai/sessions.js       riwayat chat (memori, per-sesi)
                 └─ ai/format.js         penyucian teks lintas kanal
                       ▼
domain/*  (products, orders, customers, reports, staff)  ──►  db/index.js (pool MySQL)

Telegram / WhatsApp (backend/channels)  ──►  ai/agent.js  (role & konteks kanal)
```

## Staf virtual
| ID | Nama | Peran | Tools |
|---|---|---|---|
| cs | Sari | Customer Service | check_stock, list_products, create_order, get_order_status |
| inventory | Gudi | Inventaris | check_stock, list_products, low_stock_report, update_stock |
| finance | Fina | Keuangan | daily_report, get_order_status |
| marketing | Mika | Promosi | list_products, generate_promo_image |

## Peran dan hak akses
Peran menentukan tool mana yang boleh dipakai AI:

| Peran | issu | Bisa lihat | Batas |
|---|---|---|---|
| `customer` | pengunjung landing page, pelanggan Telegram/WhatsApp | produk, stok, pesanan miliknya | maks. 20 pcs per produk, tidak boleh melihat laba/modal/laporan |
| `staff` | admin yang login ke dashboard | produk, stok, pesanan, pelanggan, laporan harian | akses penuh operasional |
| `owner` | pemilik lewat Telegram (daftar di `TELEGRAM_OWNER_IDS`) | semuanya | boleh melihat laba, modal, dan statistik |

## Catatan desain
- **Satu sumber kebenaran untuk data.** AI tidak pernah query database langsung; semua lewat `domain/*` melalui `ai/tools.js`, sehingga aturan bisnis (stok tidak boleh negatif, batas qty pelanggan) hanya ada di satu tempat.
- **Stok aman dari penjualan ganda.** Pembuatan pesanan berjalan dalam transaksi MySQL dengan `SELECT ... FOR UPDATE`, lalu pengurangan stok memakai `GREATEST(stock - ?, 0)` agar tidak pernah minus.
- **Provider AI gratis dengan failover.** `ai/providers.js` mencoba Groq, lalu Gemini, lalu Freebuff. Provider yang gagal/cooldown otomatis dilewati, dan sistem turun ke mode demo berbasis aturan daripada membiarkan pengguna tanpa jawaban.
- **Mode demo tetap berfungsi.** Tanpa API key, `ai/agent.js` memakai `runDemoAgent()` berbasis aturan sehingga seluruh alur (stok, pesanan, laporan, poster) tetap bisa dicoba.
- **Status staf di memori proses.** `domain/staff.js` menyimpan status `idle`/`working`/`error` dan dibaca dashboard tiap 2 detik; jejak audit ringan masuk ke tabel `staff_activity`.
- **Sesi chat di memori.** `ai/sessions.js` membatasi jumlah sesi dan pesan per sesi; di produksi banyak instance, ganti dengan penyimpanan bersama (Redis).
- **Rate limit-two lapis.** Channel (`backend/channels/context.js`) membatasi pesan per pengguna, dan `lib/rateLimit.js` membatasi per IP untuk melindungi kuota free tier. `X-Forwarded-For` hanya dipercaya bila `TRUST_PROXY=true`.
- **Pencocokan produk bertahap.** "stok kopi robusta" tetap menemukan `Kopi Robusta Lampung 250g` karena `domain/products.js` mencoba kecocokan persis → prefiks → fuzzy berurutan, bukan sekadar `LIKE`.
