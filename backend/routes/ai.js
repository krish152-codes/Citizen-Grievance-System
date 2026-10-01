const express = require('express');
const router = express.Router();
const { classify, previewClassify, detect, sentiment, generateLetter, transcribe } = require('../controllers/aiController');
const { optionalAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Tiny in-memory rate limiter — /transcribe calls a paid API and is public
// (anonymous citizens can report), so cap it per IP: 15 requests / 10 min.
const hits = new Map();
const transcribeLimiter = (req, res, next) => {
  const now = Date.now(), win = 10 * 60 * 1000;
  const arr = (hits.get(req.ip) || []).filter(t => now - t < win);
  if (arr.length >= 15) return res.status(429).json({ success: false, message: 'Too many transcription requests. Try again in a few minutes.' });
  arr.push(now); hits.set(req.ip, arr);
  next();
};
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (!v.some(t => now - t < 600000)) hits.delete(k); }, 600000).unref();

router.post('/transcribe', transcribeLimiter, upload.voiceUpload.single('voice'), transcribe);
router.post('/classify', classify);
router.post('/preview-classify', previewClassify);
router.post('/detect', upload.single('image'), detect);
router.post('/sentiment', sentiment);
router.post('/generate-letter', optionalAuth, generateLetter);

module.exports = router;