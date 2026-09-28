const reportModel = require('../../modules/reports/reportModel');

exports.daily = async (req, res) => res.json(await reportModel.daily(req.query.date));
