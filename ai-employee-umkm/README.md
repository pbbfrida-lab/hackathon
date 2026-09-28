# OmniStaff AI (UMKM Autonomous Virtual Workforce)

Pekerja virtual berbasis AI multi-agent dengan kantor virtual 3D untuk operasional harian UMKM.
Dibangun mengikuti blueprint di https://github.com/Basuki-rahmat/global-hackathon (Meta Global AI Developer Hackathon).

## Fitur
- Dashboard 3D Virtual Office: avatar staf bergerak saat bekerja (Three.js)
- AI Customer Service, Inventaris, Keuangan, dan Promosi (function calling)
- Chat teks dan perintah suara (Web Speech API, bahasa Indonesia)
- Pembuat poster promosi (poster SVG lokal, atau API gambar lewat `IMAGE_API_URL`)
- Laporan penjualan dan laba harian
- Kanal pelanggan: **Telegram** dan **WhatsApp Business Cloud API** (pelanggan hanya dilayani customer service; pemilik mendapat akses penuh) — lihat `docs/channels.md`

## Prasyarat
Laragon (MySQL), Node.js 18+ (LTS terbaru), dan koneksi internet (Three.js dimuat dari CDN).

## Instalasi
1. Letakkan folder ini di `C:\laragon\www\ai-employee-umkm`.
2. Jalankan **Start All** di Laragon.
3. Buat database dan tabel + data contoh (cukup sekali):
   ```
   npm install
   npm run db:init -- --seed
   ```
   Alternatif manual: impor `database/migrations/schema.sql` lalu `database/seeds/dummyData.sql` lewat HeidiSQL.
4. Salin `.env.example` menjadi `.env`, lalu isi `META_API_KEY`. Cocokkan `META_API_BASE_URL` dan `META_MODEL` dengan dokumentasi Meta AI di https://dev.meta.ai/events/global-hackathon.
5. Jalankan:
   ```
   npm start
   ```
6. Buka http://localhost:3000 (dashboard) dan http://localhost:3000/chat (chat + suara).

Tanpa `META_API_KEY`, aplikasi berjalan di **mode demo** (jawaban berbasis aturan) sehingga alur tetap bisa dicoba.

## Endpoint utama
| Method | Path | Fungsi |
|---|---|---|
| GET | /api/health | Cek server, database, mode AI |
| GET | /api/staff | Status staf virtual |
| GET/PATCH | /api/products, /api/products/:id/stock | Produk dan stok |
| GET/POST | /api/orders, PATCH /api/orders/:id/status | Pesanan |
| GET | /api/reports/daily?date=YYYY-MM-DD | Laporan harian |
| POST | /api/ai/chat, /api/ai/voice, /api/ai/promo | Agen AI |

| POST/GET | /webhook/whatsapp, /webhook/telegram | Webhook kanal chat (verifikasi sendiri, di luar `x-api-key`) |

Dokumentasi lebih rinci ada di folder `docs/`.
