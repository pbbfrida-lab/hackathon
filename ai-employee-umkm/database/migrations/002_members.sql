-- Member = pelanggan yang mendaftar (nama, email, no. telepon).
-- Berbeda dengan tabel `customers` yang dipakai untuk pencocokan chat dan pesanan:
-- di sini identitas utama adalah email, sedangkan nomor telepon dipakai untuk
-- menghubungkan member dengan riwayatnya lewat kanal chat (Telegram/WhatsApp).
USE __DB_NAME__;

CREATE TABLE IF NOT EXISTS members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  note VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_members_email (email),
  UNIQUE KEY uq_members_phone (phone),
  KEY idx_members_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
