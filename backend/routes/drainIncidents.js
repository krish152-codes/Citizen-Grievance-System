const express = require('express');
const router = express.Router();
const {
  getIncidents,
  getIncidentById,
  createIncident,
  updateIncident,
} = require('../controllers/drainIncidentController');
const { protect } = require('../middleware/auth');
const { municipalOnly } = require('../middleware/municipalAuth');

// Any authenticated user (citizen included) can create an incident — e.g.
// from their own Drain Echo diagnostic. Viewing the queue and progressing
// the workflow is municipal-staff only.
router.get('/',        protect, municipalOnly, getIncidents);
router.get('/:id',      protect, municipalOnly, getIncidentById);
router.post('/',        protect,                createIncident);
router.patch('/:id',    protect, municipalOnly, updateIncident);

module.exports = router;
