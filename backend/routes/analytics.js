const express = require('express');
const router = express.Router();
const { getSummary, getZoneStatus } = require('../controllers/analyticsController');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/summary', protect, adminOnly, getSummary);
router.get('/zones', protect, adminOnly, getZoneStatus);

module.exports = router;
