const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET || 'secret_fallback', {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;
    console.log('📝 Register attempt:', { name, email, role });

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      // Instead of error, just log them in (better UX)
      const token = generateToken(existingUser._id);
      return res.status(200).json({
        success: true,
        message: 'Account already exists — logged in',
        token,
        user: {
          id: existingUser._id,
          name: existingUser.name,
          email: existingUser.email,
          role: existingUser.role,
          department: existingUser.department,
        },
      });
    }

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      phone: phone || '',
      role: role || 'citizen',
    });

    console.log('✅ User created:', user._id, user.email);
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
      },
    });
  } catch (error) {
    console.error('❌ Register error:', error);
    res.status(500).json({ success: false, message: error.message || 'Registration failed' });
  }
};

// @desc    Login with email + password
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('🔑 Login attempt:', email);

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
    if (!user) {
      console.log('❌ User not found:', email);
      return res.status(401).json({ success: false, message: 'No account found with this email. Please register first.' });
    }

    if (!user.password) {
      return res.status(401).json({ success: false, message: 'This account uses OTP login. Please use Magic OTP tab.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.log('❌ Wrong password for:', email);
      return res.status(401).json({ success: false, message: 'Incorrect password. Try: admin123 for admin accounts.' });
    }

    console.log('✅ Login success:', user.email, user.role);
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ success: false, message: error.message || 'Login failed' });
  }
};

// @desc    Send OTP for login
// @route   POST /api/auth/otp/send
// @access  Public
const sendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    let user = await User.findOne({ email });
    if (!user) {
      // Create a minimal guest user for OTP login
      user = await User.create({ name: 'New User', email, role: 'citizen' });
    }

    const otpCode = user.generateOTP();
    await user.save();

    // In production, send via SMS/email. Here we simulate:
    console.log(`📱 OTP for ${email}: ${otpCode}`);

    res.json({
      success: true,
      message: 'OTP sent successfully',
      // Return OTP in dev mode only
      ...(process.env.NODE_ENV === 'development' && { otp: otpCode }),
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to send OTP' });
  }
};

// @desc    Verify OTP
// @route   POST /api/auth/otp/verify
// @access  Public
const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.otp || !user.otp.code) {
      return res.status(400).json({ success: false, message: 'No OTP requested' });
    }

    if (new Date() > new Date(user.otp.expiresAt)) {
      return res.status(400).json({ success: false, message: 'OTP has expired' });
    }

    if (user.otp.code !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    // Clear OTP
    user.otp = undefined;
    await user.save();

    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'OTP verified successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
      },
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ success: false, message: error.message || 'OTP verification failed' });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Guest login (no credentials needed)
// @route   POST /api/auth/guest
// @access  Public
const guestLogin = async (req, res) => {
  try {
    const guestUser = {
      id: 'guest-' + Date.now(),
      name: 'Guest User',
      email: 'guest@sheharsetu.gov',
      role: 'citizen',
      isGuest: true,
    };
    const token = jwt.sign(guestUser, process.env.JWT_SECRET || 'secret_fallback', { expiresIn: '1d' });
    res.json({ success: true, token, user: guestUser });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { register, login, sendOTP, verifyOTP, getMe, guestLogin };
