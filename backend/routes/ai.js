const express = require('express');
const router = express.Router();
const { classify, detect, sentiment } = require('../controllers/aiController');
const upload = require('../middleware/upload');

router.post('/classify', classify);
router.post('/detect', upload.single('image'), detect);
router.post('/sentiment', sentiment);

module.exports = router;
