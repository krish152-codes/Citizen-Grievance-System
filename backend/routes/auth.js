const express = require('express');
const router = express.Router();
const { register, login, sendOTP, verifyOTP, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.post('/otp/send', sendOTP);
router.post('/otp/verify', verifyOTP);
router.get('/me', protect, getMe);

module.exports = router;
