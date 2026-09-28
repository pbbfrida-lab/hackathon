USE ai_employee_umkm;

INSERT IGNORE INTO products (sku, name, description, price, cost, stock, low_stock_threshold) VALUES
('KOP-001', 'Kopi Robusta Lampung 250g', 'Biji kopi robusta sangrai medium, aroma cokelat pekat.', 45000, 28000, 40, 10),
('KOP-002', 'Kopi Bubuk Tubruk 500g', 'Kopi bubuk tubruk untuk seduh harian.', 70000, 46000, 8, 10),
('KRP-001', 'Keripik Pisang Coklat', 'Keripik pisang khas Lampung dengan balutan coklat.', 25000, 13000, 60, 15),
('KRP-002', 'Keripik Singkong Balado', 'Keripik singkong renyah rasa balado pedas manis.', 18000, 9000, 4, 10),
('SMB-001', 'Sambal Terasi Botol', 'Sambal terasi rumahan tanpa pengawet.', 32000, 17000, 25, 8);

INSERT IGNORE INTO customers (name, phone, address) VALUES
('Siti Rahma', '081234567001', 'Bandar Lampung'),
('Budi Santoso', '081234567002', 'Metro');

INSERT INTO orders (customer_id, status, total) VALUES
((SELECT id FROM customers WHERE phone='081234567001'), 'paid', 115000),
((SELECT id FROM customers WHERE phone='081234567002'), 'processing', 50000);

INSERT INTO order_items (order_id, product_id, qty, unit_price, unit_cost)
SELECT o.id, p.id, 2, p.price, p.cost FROM orders o, products p
WHERE o.id = (SELECT MIN(id) FROM orders) AND p.sku = 'KOP-001';
INSERT INTO order_items (order_id, product_id, qty, unit_price, unit_cost)
SELECT o.id, p.id, 1, p.price, p.cost FROM orders o, products p
WHERE o.id = (SELECT MIN(id) FROM orders) AND p.sku = 'KRP-001';
INSERT INTO order_items (order_id, product_id, qty, unit_price, unit_cost)
SELECT o.id, p.id, 2, p.price, p.cost FROM orders o, products p
WHERE o.id = (SELECT MAX(id) FROM orders) AND p.sku = 'KRP-001';
