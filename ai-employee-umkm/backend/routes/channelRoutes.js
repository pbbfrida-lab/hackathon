const express = require('express');
const telegram = require('../channels/telegram');
const whatsapp = require('../channels/whatsapp');

const router = express.Router();
router.get('/whatsapp', whatsapp.verify);
router.post('/whatsapp', whatsapp.receive);
router.post('/telegram', telegram.webhook);

module.exports = router;
