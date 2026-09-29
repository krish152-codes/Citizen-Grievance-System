const express = require('express');
const router = express.Router();
const { verifyWebhook, receiveWebhook } = require('../controllers/whatsappWebhookController');

// GET: Meta's one-time subscription verification challenge.
router.get('/', verifyWebhook);

// POST: inbound message events. Uses express.raw() (not the app-wide JSON
// parser) so the controller can verify Meta's HMAC signature against the
// *exact* bytes that were signed — parsing to JSON first would break that.
router.post('/', express.raw({ type: '*/*', limit: '10mb' }), receiveWebhook);

module.exports = router;
