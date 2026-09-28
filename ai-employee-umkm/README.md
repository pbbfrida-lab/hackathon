# OmniStaff AI (UMKM Autonomous Virtual Workforce)

Pekerja virtual berbasis AI multi-agent untuk operasional harian UMKM.
Berisi **landing page publik dengan live customer service**, dashboard 3D, dan kanal Telegram/WhatsApp.

## Fitur
- **Landing page** (`frontend/landing/`) dengan katalog langsung dari database dan **widget live customer service**
- Dashboard 3D Virtual Office: avatar staf bergerak saat bekerja (Three.js)
- Empat staf AI: Customer Service, Inventaris, Keuangan, dan Promosi (function calling)
- Chat teks dan perintah suara (Web Speech API, bahasa Indonesia)
- Pembuat poster promosi (poster SVG lokal, atau API gambar lewat `IMAGE_API_URL`)
- Laporan penjualan dan laba harian
- Kanal pelanggan: **Telegram** dan **WhatsApp Business Cloud API** — lihat `docs/channels.md`

## AI gratis (tanpa Meta API)
| Provider | Env | Model default | Catatan |
|---|---|---|---|
| Groq | `GROQ_API_KEY` | `openai/gpt-oss-120b` | utama, paling cepat |
| Google AI Studio | `GEMINI_API_KEY` | `gemini-3.8-flash` | cadangan |
| Freebuff | `FREEBUFF_API_KEY` | `deepseek/deepseek-v4-flash` | lewat proxy OpenAI-compatible |

Provider dicoba berurutan; yang gagal atau kena rate-limit otomatis dilewati.

## Prasyarat
Laragon (MySQL), Node.js 18+, dan koneksi internet (Three.js dimuat dari CDN).

## Instalasi
1. Letakkan folder ini di `C:\laragon\www\ai-employee-umkm`.
2. Jalankan **Start All** di Laragon.
3. Buat database dan tabel + data contoh (cukup sekali):
   ```
   npm install
   npm run db:init -- --seed
   ```
   Alternatif manual: impor `database/migrations/schema.sql` lalu `database/seeds/dummyData.sql` lewat HeidiSQL.
4. Salin `.env.example` menjadi `.env`, lalu isi minimal satu API key provider gratis.
   Diagnosis cepat: `npm run doctor`.
5. Jalankan:
   ```
   npm start
   ```
6. Buka:
   - http://localhost:3000 — landing page + live CS
   - http://localhost:3000/dashboard/ — dashboard 3D
   - http://localhost:3000/chat — chat lengkap + suara

Tanpa API key provider, aplikasi berjalan di **mode demo** (jawaban berbasis aturan) sehingga seluruh alur tetap bisa dicoba.

### Pembayaran PayPal (opsional)
PayPal checkout di katalog menggunakan **USD**. Harga produk dan pesanan tetap disimpan dalam Rupiah, lalu dikonversi memakai kurs IDR per USD yang Anda tetapkan. Kurs tidak diambil otomatis.

1. Buat aplikasi REST di [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/applications). Untuk pengujian, pilih aplikasi sandbox dan siapkan akun sandbox buyer.
2. Isi konfigurasi berikut di `.env` memakai kredensial sandbox. Ganti nilai kurs dengan jumlah Rupiah untuk 1 USD yang ingin digunakan:
   ```env
   PAYPAL_MODE=sandbox
   PAYPAL_CLIENT_ID=CLIENT_ID_SANDBOX
   PAYPAL_CLIENT_SECRET=CLIENT_SECRET_SANDBOX
   PAYPAL_IDR_PER_USD=ISI_KURS_IDR_PER_USD
   ```
3. Jalankan `npm run db:init` agar tabel pencatatan pembayaran PayPal dibuat. Perintah ini juga aman dijalankan pada database yang sudah ada.
4. Restart server. Pemilih pembayaran PayPal muncul di katalog hanya jika Client ID, Client Secret, dan kurs sudah diisi dengan benar.
5. Uji checkout dengan akun sandbox buyer. Untuk menerima transaksi sungguhan, ganti Client ID dan Secret dengan kredensial aplikasi live, ubah `PAYPAL_MODE=live`, gunakan kurs terkini, dan layani situs melalui HTTPS.

Jangan masukkan Client Secret ke frontend atau commit file `.env`. Nilai USD ditampilkan dan dibayar melalui PayPal; perbedaan pembulatan kurs dapat memengaruhi nominal akhir.

## Endpoint utama
| Method | Path | Fungsi |
|---|---|---|
| GET | / | Landing page |
| GET | /api/health | Cek server, database, mode AI |
| GET | /api/public/status, /api/public/catalog | Data untuk landing page (tanpa API key) |
| GET | /api/public/paypal/config | Status dan konfigurasi publik PayPal |
| POST | /api/public/paypal/orders, /api/public/paypal/capture | Buat dan verifikasi pembayaran PayPal |
| POST | /api/public/paypal/cancel | Batalkan pesanan PayPal yang belum dibayar |
| POST | /api/public/chat | Live customer service, peran `customer`, rate limit per IP |
| GET | /api/staff | Status staf virtual |
| GET/PATCH | /api/products, /api/products/:id/stock | Produk dan stok |
| GET/POST | /api/orders, PATCH /api/orders/:id/status | Pesanan |
| GET | /api/reports/daily?date=YYYY-MM-DD | Laporan harian |
| POST | /api/ai/chat, /api/ai/voice, /api/ai/promo | Agen AI (peran staf) |
| POST/GET | /webhook/whatsapp, /webhook/telegram | Webhook kanal (verifikasi sendiri, di luar `x-api-key`) |

## Keamanan
- Isi `APP_API_KEY` untuk produksi; tanpa itu semua `/api/*` terbuka.
- `/api/public/*` memang terbuka untuk pengunjung, tetapi peran dikunci `customer`: pengunjung hanya bisa bertanya produk dan membuat pesanan (maks. `MAX_CUSTOMER_QTY_PER_PRODUCT` per produk), tidak bisa melihat laba, modal, atau data pelanggan lain.
- `X-Forwarded-For` hanya dipercaya bila `TRUST_PROXY=true`.
- Kredensial hanya ada di `.env` yang sudah masuk `.gitignore`.

Dokumentasi lebih rinci ada di folder `docs/`.
