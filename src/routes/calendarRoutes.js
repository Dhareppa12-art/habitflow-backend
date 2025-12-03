const express = require('express');
const HabitCompletion = require('../models/HabitCompletion');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/calendar/:year/:month   (month: 1-12)
router.get('/:year/:month', authMiddleware, async (req, res) => {
  const year = parseInt(req.params.year, 10);
  const month = parseInt(req.params.month, 10) - 1; // JS month index 0–11

  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 1);

  const completions = await HabitCompletion.aggregate([
    {
      $match: {
        user: req.user.id,
        date: { $gte: start, $lt: end }
      }
    },
    {
      $group: {
        _id: { $dayOfMonth: '$date' },
        total: { $sum: '$count' }
      }
    }
  ]);

  // Transform to { day: 1..31, total }
  const result = completions.map((c) => ({
    day: c._id,
    total: c.total
  }));

  res.json({ success: true, data: result });
});

module.exports = router;
