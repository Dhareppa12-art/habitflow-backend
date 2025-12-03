const express = require('express');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/profile
router.get('/', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json({ success: true, data: user });
  } catch (err) {
    console.error('PROFILE GET ERROR', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/profile
router.put('/', authMiddleware, async (req, res) => {
  try {
    const {
      name,location,phone,avatar,

      emailReminders,
      dailyReminder,
      weeklySummary,

      timezone,
      weekStart,
      themePreference,
    } = req.body;

    const update = {};

    if (typeof name === 'string') update.name = name;
    if (typeof location === 'string') update.location = location;
    if (typeof phone === 'string') update.phone = phone;
    if (typeof avatar === 'string') update.avatar = avatar;

    if (typeof emailReminders === 'boolean')
      update.emailReminders = emailReminders;
    if (typeof dailyReminder === 'boolean')
      update.dailyReminder = dailyReminder;
    if (typeof weeklySummary === 'boolean')
      update.weeklySummary = weeklySummary;

    if (typeof timezone === 'string') update.timezone = timezone;
    if (typeof weekStart === 'string') update.weekStart = weekStart;
    if (typeof themePreference === 'string')
      update.themePreference = themePreference;

    const updated = await User.findByIdAndUpdate(req.user.id, update, {
      new: true,
    }).select('-password');

    res.json({
      success: true,
      data: updated,
      message: 'Profile updated',
    });
  } catch (err) {
    console.error('PROFILE UPDATE ERROR', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
