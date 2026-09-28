# Arsitektur OmniStaff AI

```
Browser (dashboard 3D + chat/suara)      Telegram / WhatsApp (pelanggan & pemilik)
        │  HTTP (JSON)                            │  polling / webhook (backend/channels)
Express (backend/server.js)
  ├─ /api/*        REST: produk, pesanan, laporan, status staf
  └─ /api/ai/*     chat, voice, promo  ──►  ai/agent/orchestrator.js
                                              ├─ router: pilih staf (kata kunci, fallback LLM)
                                              ├─ agen + tools (ai/tools/index.js)
                                              └─ Meta AI API (backend/services/metaAiService.js)
MySQL (customers, products, orders, order_items, staff_activity)
```

## Staf virtual
| ID | Nama | Peran | Tools |
|---|---|---|---|
| cs | Sari | Customer Service | check_stock, list_products, create_order, get_order_status |
| inventory | Gudi | Inventaris | check_stock, list_products, low_stock_report, update_stock |
| finance | Fina | Keuangan | daily_report, get_order_status |
| marketing | Mika | Promosi | list_products, generate_promo_image |

## Catatan desain
- `modules/*` berisi akses data; controller dan tools memakai modul yang sama sehingga aturan bisnis (mis. stok tidak boleh negatif) satu tempat.
- Pembuatan pesanan berjalan dalam transaksi MySQL dengan `SELECT ... FOR UPDATE` agar stok tidak bisa terjual ganda.
- Status staf disimpan di memori proses (`modules/employees/staffStatus.js`) dan dibaca dashboard tiap 2 detik.
- Tanpa `META_API_KEY`, orchestrator memakai mode demo berbasis aturan supaya seluruh alur tetap bisa dicoba.
