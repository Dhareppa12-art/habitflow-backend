const express = require('express');
const Habit = require('../models/Habit');
const HabitCompletion = require('../models/HabitCompletion');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Convert a Date into YYYY-MM-DD string safely
const toDayString = (d) => {
  return new Date(d).toISOString().slice(0, 10);
};

// ---------------------------------------------
// GET /api/stats/overview  → Dashboard cards
// ---------------------------------------------
router.get('/overview', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const today = new Date();
    const todayStr = toDayString(today);

    // last 30 days including today
    const last30 = new Date(today);
    last30.setDate(today.getDate() - 29);
    const last30Str = toDayString(last30);

    // Active habits
    const habits = await Habit.find({ user: userId, isActive: true });
    const totalHabits = habits.length;

    let todaysCompletions = 0;
    let completionsLast30 = 0;

    // track days for streaks
    const daySet = new Set();

    habits.forEach((habit) => {
      (habit.completedDates || []).forEach((d) => {
        const dayStr = toDayString(d);

        // count only last 30 days
        if (dayStr >= last30Str && dayStr <= todayStr) {
          completionsLast30++;
          daySet.add(dayStr);

          // count today
          if (dayStr === todayStr) {
            todaysCompletions++;
          }
        }
      });
    });

    // Completion rate
    const totalPossible = totalHabits * 30 || 1;
    const completionRate = Math.round((completionsLast30 / totalPossible) * 100);

    // Best streak (consecutive days with any completions)
    const days = Array.from(daySet).sort();
    let bestStreak = 0;
    let currentStreak = 0;
    let prevDay = null;

    for (const dayStr of days) {
      if (!prevDay) {
        currentStreak = 1;
      } else {
        const diff =
          (new Date(dayStr) - new Date(prevDay)) / (24 * 60 * 60 * 1000);

        if (diff === 1) {
          currentStreak++;
        } else {
          currentStreak = 1;
        }
      }

      bestStreak = Math.max(bestStreak, currentStreak);
      prevDay = dayStr;
    }

    res.json({
      success: true,
      data: {
        totalHabits,
        todaysCompletions,
        completionRate,
        bestStreak,
      },
    });
  } catch (err) {
    console.error('STATS OVERVIEW ERROR', err);
    res.status(500).json({
      success: false,
      message: 'Server error loading stats',
    });
  }
});

// ---------------------------------------------
// GET /api/stats/weekly  → "This week" chart
// ---------------------------------------------
router.get('/weekly', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Monday start
    const startOfWeek = new Date(today);
    const day = startOfWeek.getDay();
    const diff = (day === 0 ? -6 : 1) - day; // adjust if Sunday
    startOfWeek.setDate(startOfWeek.getDate() + diff);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    const completions = await HabitCompletion.aggregate([
      {
        $match: {
          user: userId,
          date: { $gte: startOfWeek, $lt: endOfWeek },
        },
      },
      {
        $group: {
          _id: { $dayOfWeek: '$date' }, // 1=Sun ... 7=Sat
          total: { $sum: '$count' },
        },
      },
    ]);

    const week = [
      { label: 'Mon', value: 0 },
      { label: 'Tue', value: 0 },
      { label: 'Wed', value: 0 },
      { label: 'Thu', value: 0 },
      { label: 'Fri', value: 0 },
      { label: 'Sat', value: 0 },
      { label: 'Sun', value: 0 },
    ];

    completions.forEach((c) => {
      const mongoDay = c._id;
      const idx = (mongoDay + 5) % 7;
      week[idx].value = c.total;
    });

    res.json({ success: true, data: week });
  } catch (err) {
    console.error('WEEKLY STATS ERROR', err);
    res.status(500).json({
      success: false,
      message: 'Server error loading weekly stats',
    });
  }
});

// ---------------------------------------------
// GET /api/stats/top-habits → Right side card
// ---------------------------------------------
router.get('/top-habits', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const aggregation = await HabitCompletion.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: '$habit',
          totalCompletions: { $sum: '$count' },
          lastDate: { $max: '$date' },
        },
      },
      {
        $lookup: {
          from: 'habits',
          localField: '_id',
          foreignField: '_id',
          as: 'habit',
        },
      },
      { $unwind: '$habit' },
      { $sort: { totalCompletions: -1 } },
      { $limit: 5 },
    ]);

    const response = aggregation.map((item) => ({
      habitId: item.habit._id,
      title: item.habit.title,
      totalCompletions: item.totalCompletions,
      lastCompleted: item.lastDate,
    }));

    res.json({ success: true, data: response });
  } catch (err) {
    console.error('TOP HABITS ERROR', err);
    res.status(500).json({
      success: false,
      message: 'Server error loading top habits',
    });
  }
});

module.exports = router;
