const express = require('express');
const router = express.Router();
const { sendMessage, sendLocation, sendImage, sendVoice, getConversation } = require('../controllers/chatbotController');
const { optionalAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Guest usage is allowed throughout, matching the existing /issues/report
// flow (optionalAuth) — logging in is never required to report a problem.
router.post('/message',  optionalAuth, sendMessage);
router.post('/location', optionalAuth, sendLocation);
router.post('/image',    optionalAuth, upload.single('image'), sendImage);
router.post('/voice',    optionalAuth, upload.voiceUpload.single('voice'), sendVoice);
router.get('/conversation/:id', optionalAuth, getConversation);

module.exports = router;
