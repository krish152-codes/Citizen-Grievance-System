const User = require('../models/User');

// @desc    Get all users (admin)
// @route   GET /api/users
// @access  Admin
const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, role, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {};
    if (role) query.role = role;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(query).sort({ lastActive: -1 }).skip(skip).limit(parseInt(limit)),
      User.countDocuments(query),
    ]);

    res.json({
      success: true,
      users,
      pagination: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Invite / create a user
// @route   POST /api/users/invite
// @access  Admin
const inviteUser = async (req, res) => {
  try {
    const { name, email, role, department } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Name and email are required' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ success: false, message: 'User already exists' });
    }

    const tempPassword = Math.random().toString(36).slice(-8);
    const user = await User.create({ name, email, password: tempPassword, role, department });

    res.status(201).json({ success: true, message: 'User invited successfully', user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update user role/status
// @route   PATCH /api/users/:id
// @access  Admin
const updateUser = async (req, res) => {
  try {
    const { role, department, isActive } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role, department, isActive },
      { new: true, runValidators: true }
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getUsers, inviteUser, updateUser };
