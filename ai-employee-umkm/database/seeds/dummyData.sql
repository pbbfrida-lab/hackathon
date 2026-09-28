USE __DB_NAME__;

INSERT IGNORE INTO products (sku, name, description, price, cost, stock, low_stock_threshold) VALUES
('KOP-001', 'Kopi Robusta Lampung 250g', 'Biji kopi robusta sangrai medium, aroma cokelat pekat.', 45000, 28000, 40, 10),
('KOP-002', 'Kopi Bubuk Tubruk 500g', 'Kopi bubuk tubruk untuk seduh harian.', 70000, 46000, 8, 10),
('KRP-001', 'Keripik Pisang Coklat', 'Keripik pisang khas Lampung dengan balutan coklat.', 25000, 13000, 60, 15),
('KRP-002', 'Keripik Singkong Balado', 'Keripik singkong renyah rasa balado pedas manis.', 18000, 9000, 4, 10),
('SMB-001', 'Sambal Terasi Botol', 'Sambal terasi rumahan tanpa pengawet.', 32000, 17000, 25, 8);

-- Nomor HP disimpan dalam format internasional tanpa "+" (lihat backend/domain/customers.js).
INSERT IGNORE INTO customers (name, phone, address) VALUES
('Siti Rahma', '6281234567001', 'Bandar Lampung'),
('Budi Santoso', '6281234567002', 'Metro');

-- Contoh member (registrasi publik: nama + email + no. telepon).
INSERT IGNORE INTO members (name, email, phone) VALUES
('Siti Rahma', 'siti.rahma@example.com', '6281234567001'),
('Budi Santoso', 'budi.santoso@example.com', '6281234567002');

-- Pesanan & rinciannya dijaga agar hanya dibuat sekali. `INSERT IGNORE` TIDAK bisa
-- dipakai di sini: orders dan order_items tidak punya unique key selain id, jadi setiap
-- `db:init --seed` akan menambah duplikat. Karena itu dipakai penjaga NOT EXISTS.
INSERT INTO orders (customer_id, status, total)
SELECT c.id, 'paid', 115000 FROM customers c
WHERE c.phone = '6281234567001'
  AND NOT EXISTS (SELECT 1 FROM orders);

INSERT INTO orders (customer_id, status, total)
SELECT c.id, 'processing', 50000 FROM customers c
WHERE c.phone = '6281234567002'
  AND NOT EXISTS (SELECT 1 FROM orders);

INSERT INTO order_items (order_id, product_id, qty, unit_price, unit_cost)
SELECT o.id, p.id, 2, p.price, p.cost FROM orders o, products p
WHERE o.id = (SELECT MIN(id) FROM orders) AND p.sku = 'KOP-001'
  AND NOT EXISTS (SELECT 1 FROM order_items WHERE order_id = o.id AND product_id = p.id);

INSERT INTO order_items (order_id, product_id, qty, unit_price, unit_cost)
SELECT o.id, p.id, 1, p.price, p.cost FROM orders o, products p
WHERE o.id = (SELECT MIN(id) FROM orders) AND p.sku = 'KRP-001'
  AND NOT EXISTS (SELECT 1 FROM order_items WHERE order_id = o.id AND product_id = p.id);

INSERT INTO order_items (order_id, product_id, qty, unit_price, unit_cost)
SELECT o.id, p.id, 2, p.price, p.cost FROM orders o, products p
WHERE o.id = (SELECT MAX(id) FROM orders) AND p.sku = 'KRP-001'
  AND NOT EXISTS (SELECT 1 FROM order_items WHERE order_id = o.id AND product_id = p.id);
