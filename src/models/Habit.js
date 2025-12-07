const mongoose = require('mongoose');

const habitSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    // match your frontend form
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'custom'],
      default: 'daily',
    },

    // OLD field (kept for compatibility with any old code)
    timeOfDay: {
      type: String, // "07:00", "21:30"
    },

    // NEW canonical reminder time (we will also store "HH:mm" here)
    reminderTime: {
      type: String, // "07:00", "21:30"
      default: '',
    },

    // reminder on/off
    reminderEnabled: {
      type: Boolean,
      default: false,
    },

    // to avoid sending the same reminder multiple times in one day
    lastReminderDate: {
      type: String, // "YYYY-MM-DD"
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // 🔥 VERY IMPORTANT: this is what streak UI uses
    completedDates: {
      type: [Date],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Habit', habitSchema);
