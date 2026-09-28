// Skrip sekali pakai: bersihkan pelanggan duplikat, order_items duplikat,
// dan selaraskan nomor member dengan pelanggan.
const db = require('../backend/db');

(async () => {
  // 1. Rincian pesanan yang sama persis dalam satu pesanan (efek seed lama tanpa penjaga).
  const dupItems = await db.many(`
    SELECT order_id, product_id, COUNT(*) n
    FROM order_items GROUP BY order_id, product_id HAVING n > 1
  `);
  for (const d of dupItems) {
    const ids = await db.many(
      'SELECT id FROM order_items WHERE order_id = ? AND product_id = ? ORDER BY id',
      [d.order_id, d.product_id]
    );
    const keep = ids[0].id;
    for (const row of ids.slice(1)) {
      await db.run('DELETE FROM order_items WHERE id = ?', [row.id]);
    }
    console.log('rincian duplikat order #' + d.order_id + ' product ' + d.product_id + ': hapus ' + (ids.length - 1) + ', sisanya #' + keep);
  }

  // 2. Pelanggan duplikat: nama sama, tanpa pesanan, tanpa member, dan bukan id terkecil.
  const dupCustomers = await db.many(`
    SELECT c.id, c.name, c.phone
    FROM customers c
    WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id)
      AND NOT EXISTS (SELECT 1 FROM members m WHERE m.phone = c.phone)
      AND c.id > (SELECT MIN(c2.id) FROM customers c2 WHERE c2.name = c.name)
  `);
  for (const d of dupCustomers) {
    await db.run('DELETE FROM customers WHERE id = ?', [d.id]);
    console.log('hapus customer duplikat #' + d.id, d.name, d.phone);
  }

  // 3. Pesanan yang nilainya tidak cocok dengan rinciannya (akibat duplikat di langkah 1).
  const orders = await db.many('SELECT id, total FROM orders ORDER BY id');
  for (const o of orders) {
    const sum = await db.one(
      'SELECT COALESCE(SUM(qty * unit_price), 0) total FROM order_items WHERE order_id = ?', [o.id]
    );
    if (Number(sum.total) !== Number(o.total)) {
      await db.run('UPDATE orders SET total = ? WHERE id = ?', [sum.total, o.id]);
      console.log('perbaiki total order #' + o.id + ': ' + o.total + ' -> ' + sum.total);
    }
  }

  console.log('--- hasil akhir ---');
  const c = await db.many('SELECT id,name,phone FROM customers ORDER BY id');
  c.forEach((r) => console.log('  customer', r.id, '|', r.name, '|', r.phone));
  const oi = await db.many('SELECT order_id, product_id, qty FROM order_items ORDER BY order_id, product_id');
  oi.forEach((r) => console.log('  item order #' + r.order_id, 'product', r.product_id, 'x' + r.qty));
  const m = await db.many('SELECT id,name,email,phone FROM members ORDER BY id');
  m.forEach((r) => console.log('  member ', r.id, '|', r.name, '|', r.email, '|', r.phone));

  await db.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
