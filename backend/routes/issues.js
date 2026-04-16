const express = require('express');
const router = express.Router();
const { reportIssue, getIssues, getIssueById, updateIssueStatus, reassignIssue, trackComplaint } = require('../controllers/issueController');
const { protect, adminOnly, optionalAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.post('/report', optionalAuth, upload.array('images', 5), reportIssue);
router.get('/', protect, getIssues);
router.get('/track/:ticketId', trackComplaint);
router.get('/:id', protect, getIssueById);
router.patch('/:id/status', protect, adminOnly, updateIssueStatus);
router.patch('/:id/reassign', protect, adminOnly, reassignIssue);

module.exports = router;
