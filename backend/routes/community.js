const express = require('express');
const router  = express.Router();
const { createPost, getPosts, toggleAppreciation, deletePost } = require('../controllers/communityController');
const { protect, optionalAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Multer errors (wrong type / too large / >2 files) -> clean 400 instead of a 500
const handleUpload = (req, res, next) => {
  upload.communityUpload(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message || 'Upload failed' });
    next();
  });
};

router.get('/',                 optionalAuth, getPosts);
router.post('/',                protect, handleUpload, createPost);
router.post('/:id/appreciate',  protect, toggleAppreciation);
router.delete('/:id',           protect, deletePost);

module.exports = router;
