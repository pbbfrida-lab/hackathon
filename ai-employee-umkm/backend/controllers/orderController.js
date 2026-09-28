const orderModel = require('../../modules/orders/orderModel');
const { httpError } = require('../middleware/errorHandler');

exports.list = async (req, res) => res.json(await orderModel.list(req.query.limit));

exports.getOne = async (req, res) => {
  const o = await orderModel.getById(req.params.id);
  if (!o) throw httpError(404, 'Pesanan tidak ditemukan.');
  res.json(o);
};

exports.create = async (req, res) => {
  const { customer_name, phone, items } = req.body || {};
  const order = await orderModel.create({
    customerName: customer_name,
    phone,
    items: (items || []).map((i) => ({ productId: i.product_id, productName: i.product_name, qty: i.qty })),
  });
  res.status(201).json(order);
};

exports.updateStatus = async (req, res) => {
  const o = await orderModel.updateStatus(req.params.id, req.body && req.body.status);
  if (!o) throw httpError(404, 'Pesanan tidak ditemukan.');
  res.json(o);
};
