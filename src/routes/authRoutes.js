const express = require('express');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

const createToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// 💌 Nodemailer transporter (same env vars as server.js)
const mailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// helper: base URL of frontend (for reset link)
const getClientBaseUrl = () => {
  // e.g. https://habitflow-frontend-hm9x.onrender.com
  return process.env.CLIENT_URL || 'http://localhost:4200';
};

/* =======================
   AUTH ROUTES
   ======================= */

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ success: false, message: 'All fields are required' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res
        .status(409)
        .json({ success: false, message: 'Email already registered' });
    }

    const user = await User.create({ name, email, password });

    const token = createToken(user);
    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
        },
      },
    });
  } catch (err) {
    console.error('SIGNUP ERROR', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res
        .status(400)
        .json({ success: false, message: 'Email and password required' });

    const user = await User.findOne({ email });
    if (!user)
      return res
        .status(401)
        .json({ success: false, message: 'Invalid credentials' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch)
      return res
        .status(401)
        .json({ success: false, message: 'Invalid credentials' });

    const token = createToken(user);
    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
        },
      },
    });
  } catch (err) {
    console.error('LOGIN ERROR', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json({ success: true, data: user });
  } catch (err) {
    console.error('ME ERROR', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current and new password are required',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long',
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res
        .status(400)
        .json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (err) {
    console.error('CHANGE PASSWORD ERROR', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* =======================
   FORGOT / RESET PASSWORD
   ======================= */

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: 'Email is required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      // Do NOT reveal if user exists – return same message
      return res.json({
        success: true,
        message:
          'If an account with that email exists, a reset link has been sent.',
      });
    }

    // create a short-lived token (15 min)
    const resetToken = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    // store token + expiry in DB
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 mins
    await user.save();

    const baseUrl = getClientBaseUrl();
    const resetUrl = `${baseUrl}/auth/reset-password/${resetToken}`;

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: user.email,
      subject: 'HabitFlow – Reset your password',
      text: `Hi ${user.name || ''},

We received a request to reset your HabitFlow password.

Click the link below to set a new password (valid for 15 minutes):

${resetUrl}

If you did not ask to reset your password, you can safely ignore this email.

— HabitFlow`,
    };

    await mailTransporter.sendMail(mailOptions);

    res.json({
      success: true,
      message:
        'If an account with that email exists, a reset link has been sent.',
    });
  } catch (err) {
    console.error('FORGOT PASSWORD ERROR', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: 'Token and new password are required',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long',
      });
    }

    // verify token first
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid or expired token' });
    }

    // find user with matching token and non-expired
    const user = await User.findOne({
      _id: decoded.id,
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid or expired token' });
    }

    // set new password – will be hashed by pre('save')
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    res.json({
      success: true,
      message: 'Password reset successful. You can now log in.',
    });
  } catch (err) {
    console.error('RESET PASSWORD ERROR', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
