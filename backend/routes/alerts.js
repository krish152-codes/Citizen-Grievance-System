const express = require('express');
const router = express.Router();
const {
  getAlerts,
  getAlertById,
  acknowledgeAlert,
  assignAlert,
  resolveAlert,
} = require('../controllers/alertController');
const { protect } = require('../middleware/auth');
const { municipalOnly } = require('../middleware/municipalAuth');

// All alert routes are municipal-staff only — alerts are an operations
// concern, not citizen-facing (citizens see drain status, not the raw
// alert queue).
router.get('/',                 protect, municipalOnly, getAlerts);
router.get('/:id',               protect, municipalOnly, getAlertById);
router.post('/:id/acknowledge',  protect, municipalOnly, acknowledgeAlert);
router.patch('/:id/assign',      protect, municipalOnly, assignAlert);
router.patch('/:id/resolve',     protect, municipalOnly, resolveAlert);

module.exports = router;
