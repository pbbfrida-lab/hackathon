const productModel = require('../../modules/products/productModel');
const { httpError } = require('../middleware/errorHandler');

exports.list = async (req, res) => res.json(await productModel.list());
exports.lowStock = async (req, res) => res.json(await productModel.lowStock());

exports.getOne = async (req, res) => {
  const p = await productModel.getById(req.params.id);
  if (!p) throw httpError(404, 'Produk tidak ditemukan.');
  res.json(p);
};

exports.adjustStock = async (req, res) => {
  const delta = Number(req.body.delta);
  if (!Number.isInteger(delta) || delta === 0) throw httpError(400, 'delta harus bilangan bulat bukan nol.');
  const p = await productModel.adjustStock(req.params.id, delta);
  if (!p) throw httpError(409, 'Produk tidak ditemukan atau stok akan menjadi negatif.');
  res.json(p);
};
