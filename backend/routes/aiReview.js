const express = require('express');
const router = express.Router();
const { getReviewQueue, reviewIssue } = require('../controllers/aiReviewController');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/',      protect, adminOnly, getReviewQueue);
router.patch('/:id', protect, adminOnly, reviewIssue);

module.exports = router;
