const express = require('express');
const products = require('../controllers/productController');
const orders = require('../controllers/orderController');
const reports = require('../controllers/reportController');
const staffStatus = require('../../modules/employees/staffStatus');

const router = express.Router();
// Bungkus handler async agar error masuk ke errorHandler.
const w = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/staff', (req, res) => res.json(staffStatus.list()));

router.get('/products', w(products.list));
router.get('/products/low-stock', w(products.lowStock));
router.get('/products/:id', w(products.getOne));
router.patch('/products/:id/stock', w(products.adjustStock));

router.get('/orders', w(orders.list));
router.post('/orders', w(orders.create));
router.get('/orders/:id', w(orders.getOne));
router.patch('/orders/:id/status', w(orders.updateStatus));

router.get('/reports/daily', w(reports.daily));

module.exports = router;
