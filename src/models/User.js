const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },

    // Profile extras
    location: { type: String },
    phone: { type: String },
    avatar: { type: String }, // base64 or URL

    // Notification settings
    emailReminders: { type: Boolean, default: true },
    dailyReminder: { type: Boolean, default: true },
    weeklySummary: { type: Boolean, default: false },

    // App settings
    timezone: { type: String, default: 'Asia/Kolkata' },
    weekStart: { type: String, default: 'monday' }, // 'sunday' | 'monday'
    themePreference: { type: String, default: 'system' }, // 'light' | 'dark' | 'system'
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
