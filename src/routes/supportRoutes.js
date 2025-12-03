const express = require('express');
const SupportMessage = require('../models/SupportMessage');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// POST /api/support
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, email, category, message } = req.body;
    const msg = await SupportMessage.create({
      name,
      email,
      category,
      message,
      user: req.user.id
    });
    res.status(201).json({ success: true, data: msg, message: 'Message received' });
  } catch (err) {
    console.error('SUPPORT MESSAGE ERROR', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/support (optional – list user’s messages)
router.get('/', authMiddleware, async (req, res) => {
  const messages = await SupportMessage.find({ user: req.user.id }).sort('-createdAt');
  res.json({ success: true, data: messages });
});

module.exports = router;
