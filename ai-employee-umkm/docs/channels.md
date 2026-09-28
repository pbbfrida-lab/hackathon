# Integrasi Telegram & WhatsApp

Pelanggan chat lewat Telegram/WhatsApp, dijawab AI yang sama dengan dashboard. Ada dua peran:

| Peran | Siapa | Akses |
|---|---|---|
| Pelanggan | semua pengirim | hanya Sari (customer service): cek harga/stok, buat pesanan (maks. 20 per produk), cek status pesanan miliknya |
| Pemilik | ID/nomor di `*_OWNER_*` | semua staf: stok, laporan keuangan, poster promosi |

Pelanggan tidak pernah mendapat tools keuangan/inventaris. Status pesanan hanya dibuka jika nomor HP cocok dengan pemesan (di WhatsApp memakai nomor pengirim yang sudah diverifikasi platform; di Telegram pelanggan menyebutkan nomornya, jadi ini pengaman ringan). Setiap pesanan baru dari pelanggan dikirim sebagai notifikasi ke pemilik.

## Telegram (paling cepat dicoba, tanpa URL publik)
1. Chat ke **@BotFather** → `/newbot` → salin token ke `TELEGRAM_BOT_TOKEN`.
2. Jalankan server (`npm start`), kirim `/id` ke bot Anda, lalu isi `TELEGRAM_OWNER_IDS` dengan ID yang muncul. Restart server.
3. Selesai. Mode default `polling` tidak butuh URL publik.
4. Opsional mode webhook: `TELEGRAM_MODE=webhook`, isi `PUBLIC_BASE_URL` (HTTPS) dan `TELEGRAM_WEBHOOK_SECRET` (string acak). Webhook tanpa secret ditolak.

Hanya chat pribadi yang dilayani. Pesan suara diproses jika `STT_API_URL` diatur; jika tidak, bot meminta pelanggan mengirim teks.

## WhatsApp Business Cloud API (resmi Meta)
1. Di https://developers.facebook.com buat app tipe Business, tambahkan produk **WhatsApp**. Anda mendapat nomor uji, *Phone number ID*, dan token akses sementara (untuk produksi buat token permanen lewat System User).
2. Isi `.env`: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN` (string bebas buatan Anda), `WHATSAPP_APP_SECRET` (App Settings → Basic → App Secret), `WHATSAPP_OWNER_NUMBERS` (nomor pemilik tanpa `+`, pisahkan koma).
3. Buka terowongan HTTPS ke port 3000, misalnya `ngrok http 3000` atau `cloudflared tunnel --url http://localhost:3000`.
4. Di WhatsApp → Configuration → Webhook: Callback URL `https://<domain-anda>/webhook/whatsapp`, Verify token sama dengan `WHATSAPP_VERIFY_TOKEN`, lalu langganan (subscribe) field **messages**.
5. Nomor uji hanya bisa mengirim ke nomor yang didaftarkan di daftar penerima uji. Untuk melayani pelanggan umum, nomor bisnis harus diverifikasi di Meta.

Keamanan: setiap POST webhook diverifikasi dengan tanda tangan `X-Hub-Signature-256` memakai `WHATSAPP_APP_SECRET`. Jika secret kosong, fitur pemilik otomatis dimatikan.

Batasan yang perlu diketahui:
- WhatsApp hanya mengizinkan balasan bebas dalam 24 jam sejak pesan terakhir pelanggan. Notifikasi pesanan ke pemilik hanya sampai jika pemilik pernah chat ke nomor bisnis dalam 24 jam terakhir (selebihnya butuh template pesan yang disetujui Meta, belum disertakan).
- Versi Graph API diatur di `WHATSAPP_GRAPH_VERSION` (default `v24.0`); sesuaikan bila Meta menghentikan versi tersebut.
- Poster promosi dikirim sebagai PNG. Jalankan `npm install` (paket opsional `sharp` mengubah SVG menjadi PNG) atau atur `IMAGE_API_URL`; tanpa itu, WhatsApp/Telegram hanya menerima pemberitahuan atau dokumen SVG.
- Riwayat percakapan dan status staf disimpan di memori server, jadi hilang saat server restart.
