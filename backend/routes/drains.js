const express = require('express');
const router = express.Router();
const {
  getDrains,
  getDrainById,
  getDrainReadings,
  getDrainTrends,
  createDrain,
  updateThresholds,
  updateCalibration,
  ingestReading,
} = require('../controllers/drainController');
const { protect, optionalAuth } = require('../middleware/auth');
const { municipalOnly } = require('../middleware/municipalAuth');

// ── Read — public-safe (citizens can see status, not raw device ingestion) ──
router.get('/',              optionalAuth, getDrains);
router.get('/:id',           optionalAuth, getDrainById);
router.get('/:id/readings',  optionalAuth, getDrainReadings);
router.get('/:id/trends',    optionalAuth, getDrainTrends);

// ── Ingestion — hardware/simulator (device key) or municipal staff ──
router.post('/:id/readings', optionalAuth, ingestReading);

// ── Municipal-only management ──
router.post('/',                  protect, municipalOnly, createDrain);
router.patch('/:id/thresholds',   protect, municipalOnly, updateThresholds);
router.patch('/:id/calibration',  protect, municipalOnly, updateCalibration);

module.exports = router;
