const express = require('express');
const Habit = require('../models/Habit');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// ----------------------------------------
// Helper: normalize a Date to local midnight
// ----------------------------------------
function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ----------------------------------------
// POST /api/habits/create   (create new habit)
// ----------------------------------------
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { title, description, frequency, timeOfDay, reminderEnabled } =
      req.body;

    if (!title) {
      return res
        .status(400)
        .json({ success: false, message: 'Title is required' });
    }

    const habit = await Habit.create({
      user: req.user.id,
      title,
      description: description || '',
      frequency: frequency || 'daily',
      timeOfDay: timeOfDay || '',
      reminderEnabled: !!reminderEnabled,
      isActive: true,
      completedDates: [], // make sure it always exists
    });

    return res.status(201).json({
      success: true,
      message: 'Habit created',
      habit,
    });
  } catch (err) {
    console.error('CREATE HABIT ERROR', err);
    return res
      .status(500)
      .json({ success: false, message: 'Server error creating habit' });
  }
});

// ----------------------------------------
// GET /api/habits/user/:userId  (list habits for user)
// ----------------------------------------
router.get('/user/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    // simple security check
    if (userId !== req.user.id) {
      return res
        .status(403)
        .json({ success: false, message: 'Not allowed to see these habits' });
    }

    const habits = await Habit.find({ user: userId, isActive: true }).sort(
      'createdAt'
    );

    return res.json({
      success: true,
      habits,
    });
  } catch (err) {
    console.error('GET MY HABITS ERROR', err);
    return res
      .status(500)
      .json({ success: false, message: 'Server error loading habits' });
  }
});

// ----------------------------------------
// GET /api/habits/one/:habitId  (get single habit)
// ----------------------------------------
router.get('/one/:habitId', authMiddleware, async (req, res) => {
  try {
    const habit = await Habit.findOne({
      _id: req.params.habitId,
      user: req.user.id,
      isActive: true,
    });

    if (!habit) {
      return res
        .status(404)
        .json({ success: false, message: 'Habit not found' });
    }

    return res.json({
      success: true,
      habit,
    });
  } catch (err) {
    console.error('GET ONE HABIT ERROR', err);
    return res
      .status(500)
      .json({ success: false, message: 'Server error loading habit' });
  }
});

// ----------------------------------------
// PUT /api/habits/update/:habitId  (update habit)
// ----------------------------------------
router.put('/update/:habitId', authMiddleware, async (req, res) => {
  try {
    const habit = await Habit.findOneAndUpdate(
      { _id: req.params.habitId, user: req.user.id, isActive: true },
      req.body,
      { new: true }
    );

    if (!habit) {
      return res
        .status(404)
        .json({ success: false, message: 'Habit not found' });
    }

    return res.json({
      success: true,
      message: 'Habit updated',
      habit,
    });
  } catch (err) {
    console.error('UPDATE HABIT ERROR', err);
    return res
      .status(500)
      .json({ success: false, message: 'Server error updating habit' });
  }
});

// ----------------------------------------
// DELETE /api/habits/delete/:habitId  (soft delete)
// ----------------------------------------
router.delete('/delete/:habitId', authMiddleware, async (req, res) => {
  try {
    const habit = await Habit.findOneAndUpdate(
      { _id: req.params.habitId, user: req.user.id },
      { isActive: false },
      { new: true }
    );

    if (!habit) {
      return res
        .status(404)
        .json({ success: false, message: 'Habit not found' });
    }

    return res.json({
      success: true,
      message: 'Habit deleted',
    });
  } catch (err) {
    console.error('DELETE HABIT ERROR', err);
    return res
      .status(500)
      .json({ success: false, message: 'Server error deleting habit' });
  }
});

// ----------------------------------------
// POST /api/habits/:habitId/check-in  (mark done today)
// ----------------------------------------
router.post('/:habitId/check-in', authMiddleware, async (req, res) => {
  try {
    const habit = await Habit.findOne({
      _id: req.params.habitId,
      user: req.user.id,
      isActive: true,
    });

    if (!habit) {
      return res
        .status(404)
        .json({ success: false, message: 'Habit not found' });
    }

    // make sure completedDates exists
    if (!Array.isArray(habit.completedDates)) {
      habit.completedDates = [];
    }

    const today = startOfDay(new Date());

    // check if already marked today
    const already = habit.completedDates.some(
      (d) => startOfDay(d).getTime() === today.getTime()
    );

    if (!already) {
      habit.completedDates.push(today);
      await habit.save();
    }

    return res.json({
      success: true,
      message: 'Marked done for today',
      habit,
    });
  } catch (err) {
    console.error('CHECK-IN HABIT ERROR', err);
    return res
      .status(500)
      .json({ success: false, message: 'Server error marking done' });
  }
});

// ----------------------------------------
// GET /api/habits/stats/overview  (basic stats)
// Used by stats / dashboard
// ----------------------------------------
router.get('/stats/overview', authMiddleware, async (req, res) => {
  try {
    const habits = await Habit.find({ user: req.user.id, isActive: true });

    const totalHabits = habits.length;

    const today = startOfDay(new Date());
    let checkInsToday = 0;
    let totalCheckIns = 0;

    habits.forEach((habit) => {
      if (!Array.isArray(habit.completedDates)) return;

      habit.completedDates.forEach((d) => {
        const day = startOfDay(d);
        totalCheckIns++;
        if (day.getTime() === today.getTime()) {
          checkInsToday++;
        }
      });
    });

    return res.json({
      success: true,
      data: {
        totalHabits,
        activeHabits: totalHabits,
        totalCheckIns,
        checkInsToday,
      },
    });
  } catch (err) {
    console.error('STATS OVERVIEW ERROR', err);
    return res
      .status(500)
      .json({ success: false, message: 'Server error loading stats' });
  }
});

module.exports = router;
