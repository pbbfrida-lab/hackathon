# Alur kerja agen AI

1. Pesan masuk lewat `POST /api/ai/chat` (atau `/api/ai/voice` dengan transkrip).
2. `orchestrator.route()` memilih staf: kata kunci dulu; jika tidak ada yang cocok dan Meta AI aktif, LLM yang mengklasifikasi.
3. Status staf berubah `working` (avatar di dashboard bergerak, lampu meja menyala).
4. Loop function calling (maks. 5 langkah): LLM meminta tool → `tools.execute()` menjalankan → hasil dikirim balik ke LLM.
5. Jawaban akhir dikembalikan beserta daftar aksi dan URL gambar (jika ada). Staf kembali `idle` setelah 4 detik.

## Contoh perintah
- "Stok kopi robusta masih ada?" → Sari
- "Pesan 2 keripik pisang coklat atas nama Rina, 08123456789" → Sari (`create_order`)
- "Produk apa yang hampir habis?" → Gudi
- "Laporan hari ini" → Fina
- "Buatkan poster sambal terasi" → Mika
