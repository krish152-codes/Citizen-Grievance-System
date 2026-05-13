const express = require('express');
const router  = express.Router();
const {
  reportIssue,
  getIssues,
  getIssueById,
  updateIssueStatus,
  reassignIssue,
  trackComplaint,
  deleteIssue,
} = require('../controllers/issueController');
const { protect, adminOnly, optionalAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

// ── Report: accepts images[] (max 8) + voice (1) ──────
router.post('/report', optionalAuth, upload.combinedUpload, reportIssue);

// ── Standard routes ───────────────────────────────────
router.get('/',                   protect,              getIssues);
router.get('/track/:ticketId',                          trackComplaint);
router.get('/:id',                protect,              getIssueById);
router.patch('/:id/status',       protect, adminOnly,   updateIssueStatus);
router.patch('/:id/reassign',     protect, adminOnly,   reassignIssue);
router.delete('/:id',             protect, adminOnly,   deleteIssue);

module.exports = router;
