const express = require('express');
const router = express.Router();
const { classify, previewClassify, detect, sentiment, generateLetter } = require('../controllers/aiController');
const { optionalAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.post('/classify', classify);
router.post('/preview-classify', previewClassify);
router.post('/detect', upload.single('image'), detect);
router.post('/sentiment', sentiment);
router.post('/generate-letter', optionalAuth, generateLetter);

module.exports = router;