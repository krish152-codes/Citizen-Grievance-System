const express = require('express');
const router = express.Router();
const { getSummary, getCitizenSummary, getZoneStatus } = require('../controllers/analyticsController');
const { protect, adminOnly } = require('../middleware/auth');

// Admin-only: full city analytics
router.get('/summary', protect, adminOnly, getSummary);
router.get('/zones', protect, adminOnly, getZoneStatus);

// Any logged-in user: citizen's own dashboard data
router.get('/citizen-summary', protect, getCitizenSummary);

module.exports = router;
