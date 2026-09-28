# OmniStaff AI (UMKM Autonomous Virtual Workforce)

> Solusi pekerja virtual berbasis AI multi-agent dengan visualisasi 3D Virtual Office interaktif untuk membantu operasional harian UMKM. Dibangun untuk mengikuti ajang **Meta Global AI Developer Hackathon**.
> <img width="1312" height="1199" alt="OmniStaff-AI" src="https://github.com/Basuki-rahmat/global-hackathon/blob/main/diagram/OmniStaff-AI.png" />

---

## 📌 Daftar Isi

1. [Tentang Proyek](#-tentang-proyek)  
2. [Fitur Utama](#-fitur-utama)  
3. [Arsitektur Sistem](#-arsitektur-sistem)  
4. [Struktur Folder Lengkap](#-struktur-folder-lengkap)  
5. [Prasyarat Sistem](#-prasyarat-sistem)  
6. [Panduan Instalasi dengan Laragon (Lokal)](#-panduan-instalasi-dengan-laragon-lokal)  
7. [Konfigurasi Environment (`.env`)](#-konfigurasi-environment-env)  
8. [Menjalankan Aplikasi](#-menjalankan-aplikasi)  
9. [Dokumentasi & Penggunaan](#-dokumentasi--penggunaan)

---


## 🚀 Tentang Proyek

**OmniStaff AI** adalah platform pekerja virtual mandiri (*autonomous AI employees*) yang dirancang khusus untuk UMKM. Proyek ini memadukan model AI mutakhir dari Meta dengan dashboard kantor virtual 3D interaktif. Sistem ini bertindak sebagai staf layanan pelanggan (*Customer Service*), manajer inventaris, hingga analis keuangan yang siap bekerja 24/7 melalui perintah teks maupun suara.

---

## ✨ Fitur Utama

* **3D Virtual Office Dashboard:** Antarmuka web interaktif di mana avatar staf AI merepresentasikan status kerja nyata.  
* **AI Customer Service:** Bot cerdas yang menjawab pertanyaan pembeli seputar produk dan status pesanan secara otomatis.  
* **Voice-Activated Commands:** Memungkinkan pemilik toko memberikan instruksi operasional langsung lewat suara (*Speech-to-Text*).  
* **AI Image Generation:** Otomatis membuat poster atau aset promosi produk baru berdasarkan deskripsi teks.  
* **Pencatatan Keuangan Kilat:** Rekapitulasi laporan penjualan dan laba-rugi otomatis setiap hari.

---

<img width="1000" height="1000" alt="diagram" src="https://github.com/Basuki-rahmat/global-hackathon/blob/main/diagram/diagram.png" />

## 🏗 Arsitektur Sistem

┌────────────────────────────────────────────────────────┐

│               Frontend (Browser / Localhost)           │

│  \- 3D Virtual Office (Three.js / Canvas)               │

│  \- Chat & Voice Interface                              │

└──────────────────────────┬─────────────────────────────┘

                           │ HTTP / WebSocket API

┌──────────────────────────▼─────────────────────────────┐

│               Backend (Node.js \+ Express)              │

│  \- RESTful API Controllers                             │

│  \- AI Orchestrator / Agent Execution Engine            │

│  \- Voice & Image Processing Handlers                   │

└───────────┬───────────────────────────┬────────────────┘

            │ SQL Queries               │ Meta AI API Calls

┌───────────▼─────────────┐   ┌─────────▼────────────────┐

│   Database (MySQL)      │   │   Meta AI Model Endpoints│

│  \- Customers, Products  │   │   \- LLM Reasoning        │

│  \- Orders, Reports      │   │   \- Image/Voice APIs     │

└─────────────────────────┘   └──────────────────────────┘

---

## 📁 Struktur Folder Lengkap

Berikut adalah struktur direktori lengkap proyek **OmniStaff AI**:

ai-employee-umkm/

├── frontend/

│   ├── dashboard/

│   │   ├── index.html       \# Halaman utama 3D Virtual Office

│   │   ├── css/             \# Lembar gaya tampilan (style.css)

│   │   └── js/              \# Logika interaksi 3D & render canvas

│   ├── ai-chat/

│   │   ├── chat.html        \# Antarmuka chat interaktif

│   │   └── voice.js         \# Pengelola input mikrofon & audio

│   └── assets/

│       ├── models/          \# Aset model 3D / avatar

│       └── promotions/      \# Hasil generate gambar produk

│

├── backend/

│   ├── controllers/

│   │   ├── productController.js  \# Kontrol logika produk & stok

│   │   ├── orderController.js    \# Kontrol logika transaksi pesanan

│   │   └── reportController.js   \# Kontrol laporan keuangan

│   ├── routes/

│   │   ├── apiRoutes.js          \# Definisi jalur RESTful API utama

│   │   └── aiRoutes.js           \# Jalur komunikasi khusus AI Agent

│   ├── services/

│   │   ├── db.js                 \# Koneksi database MySQL

│   │   └── metaAiService.js      \# Integrasi API Meta AI

│   ├── middleware/

│   │   ├── authMiddleware.js     \# Validasi sesi pengguna

│   │   └── errorHandler.js       \# Penanganan error global

│   └── server.js                 \# Titik masuk utama server Express

│

├── ai/

│   ├── agent/

│   │   └── orchestrator.js       \# Pengatur alur kerja multi-agent

│   ├── tools/

│   │   └── index.js              \# Kumpulan fungsi (checkStock, createOrder, dll)

│   ├── prompts/

│   │   └── systemPrompts.js      \# Instruksi dasar karakter staf AI

│   ├── voice/

│   │   └── sttHandler.js         \# Penanganan Speech-to-Text

│   └── image/

│       └── imgGenerator.js       \# Handler pembuat gambar promosi

│

├── modules/

│   ├── customers/

│   │   └── customerModel.js      \# Logika data pelanggan

│   ├── products/

│   │   └── productModel.js       \# Logika data inventaris produk

│   ├── orders/

│   │   └── orderModel.js         \# Logika data transaksi

│   ├── employees/

│   │   └── staffStatus.js        \# Status dan aktivitas staf virtual

│   └── reports/

│       └── reportModel.js        \# Perhitungan rekap laba-rugi

│

├── database/

│   ├── migrations/

│   │   └── schema.sql            \# Skema tabel MySQL lengkap

│   └── seeds/

│       └── dummyData.sql         \# Data awal produk & pelanggan

│

├── docs/

│   ├── architecture.md           \# Dokumentasi arsitektur sistem

│   ├── workflow.md               \# Alur interaksi agen AI

│   └── demo.md                   \# Panduan skenario video demo

│

├── .env                          \# Konfigurasi environment rahasia

├── package.json                  \# Daftar dependensi modul Node.js

└── README.md                     \# Dokumentasi utama proyek

---

## 💻 Prasyarat Sistem

Pastikan perangkat Windows Anda sudah terinstal perangkat lunak berikut:

1. **Laragon** (Sudah termasuk MySQL, Apache/Nginx, dan PHP).  
2. **Node.js** (Versi LTS terbaru) beserta npm.  
3. **Git** (Opsional untuk kloning repositori).

---

## 🛠 Panduan Instalasi dengan Laragon (Lokal)

Ikuti langkah-langkah di bawah ini untuk mengatur dan menjalankan proyek menggunakan lingkungan **Laragon**:

### 1\. Letakkan Proyek di Folder Laragon

* Buka folder instalasi Laragon Anda (biasanya di `C:\laragon\www\`).  
* Buat folder baru dengan nama `ai-employee-umkm` dan letakkan seluruh file struktur di atas ke dalam folder tersebut.

### 2\. Konfigurasi Database MySQL via Laragon

1. Buka aplikasi **Laragon**, lalu klik tombol **Start All**.  
2. Klik tombol **Database** untuk membuka aplikasi manajemen database (seperti HeidiSQL atau phpMyAdmin).  
3. Buat database baru dengan nama:  
     
   CREATE DATABASE ai\_employee\_umkm;  
     
4. Impor skema tabel dari file `database/migrations/schema.sql` ke dalam database `ai_employee_umkm` yang baru saja dibuat.

### 3\. Instalasi Dependensi Backend

Buka terminal (Command Prompt, PowerShell, atau Terminal Laragon) dan arahkan ke direktori proyek Anda:

cd C:\\laragon\\www\\ai-employee-umkm

Lalu instal dependensi yang dibutuhkan menggunakan npm:

npm install express mysql2 dotenv cors body-parser

---

## ⚙️ Konfigurasi Environment (`.env`)

Buat file bernama `.env` di root direktori proyek (`ai-employee-umkm/.env`) dan sesuaikan konfigurasi koneksi database lokal Laragon Anda:

PORT=3000

DB\_HOST=127.0.0.1

DB\_USER=root

DB\_PASS=

DB\_NAME=ai\_employee\_umkm

META\_API\_KEY=masukkan\_meta\_ai\_api\_key\_anda\_di\_sini

*(Catatan: Secara default, Laragon menggunakan user `root` tanpa password).*

---

## ▶️ Menjalankan Aplikasi

Setelah semua instalasi dan konfigurasi selesai, jalankan server backend Node.js melalui terminal:

node backend/server.js

Atau jika Anda memasang `nodemon`:

npm run dev

Buka browser Anda dan akses tautan berikut untuk melihat dashboard kantor virtual 3D:

http://localhost:3000

---

## 📖 Dokumentasi & Penggunaan

* **Arsitektur Sistem:** Lihat detail penjelasan modul di `docs/architecture.md`.  
* **Alur Kerja Agen AI:** Panduan perintah *function calling* dapat dibaca pada `docs/workflow.md`.  
* **Skenario Demo:** Panduan rekaman video untuk keperluan *submission hackathon* tersedia di `docs/demo.md`.
