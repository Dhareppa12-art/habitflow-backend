const mongoose = require('mongoose');

const habitCompletionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    habit: { type: mongoose.Schema.Types.ObjectId, ref: 'Habit', required: true },
    date: { type: Date, required: true }, // store only date part
    count: { type: Number, default: 1 }
  },
  { timestamps: true }
);

habitCompletionSchema.index({ user: 1, habit: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('HabitCompletion', habitCompletionSchema);
