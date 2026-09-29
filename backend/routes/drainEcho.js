const express = require('express');
const router = express.Router();
const {
  analyzeDrainEcho,
  getDrainEchoHistory,
  getDrainEchoById,
} = require('../controllers/drainEchoController');
const { protect } = require('../middleware/auth');
const { municipalOnly } = require('../middleware/municipalAuth');
const { drainEchoUpload } = require('../middleware/upload');

// Any authenticated user (citizen or municipal staff) can run a diagnostic.
router.post('/analyze', protect, drainEchoUpload.single('audio'), analyzeDrainEcho);

// Full history/browsing is a municipal operations view.
router.get('/history', protect, municipalOnly, getDrainEchoHistory);

// A single diagnostic can be viewed by whoever is authenticated (e.g. the
// citizen who just ran it, on their own result page).
router.get('/:id', protect, getDrainEchoById);

module.exports = router;
