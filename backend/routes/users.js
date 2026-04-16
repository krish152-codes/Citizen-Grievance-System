const express = require('express');
const router = express.Router();
const { getUsers, inviteUser, updateUser } = require('../controllers/userController');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/', protect, adminOnly, getUsers);
router.post('/invite', protect, adminOnly, inviteUser);
router.patch('/:id', protect, adminOnly, updateUser);

module.exports = router;
