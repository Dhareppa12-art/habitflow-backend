require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/db');

const cron = require('node-cron');
const nodemailer = require('nodemailer');
const Habit = require('./models/Habit');

// Routes
const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const habitRoutes = require('./routes/habitRoutes');
const statsRoutes = require('./routes/statsRoutes');
const calendarRoutes = require('./routes/calendarRoutes');
const supportRoutes = require('./routes/supportRoutes');
const aiRoutes = require('./routes/aiRoutes');

const app = express();

/* =========================
   DATABASE
========================= */
connectDB();

/* =========================
   MIDDLEWARE
========================= */
app.use(express.json());
app.use(morgan('dev'));

/* =========================
   CORS (AZURE SAFE)
========================= */
const allowedOrigins = [
  'http://localhost:4200',
  'https://habitflow-frontend-hm9x.onrender.com',
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      console.log('❌ CORS blocked:', origin);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

/* =========================
   HEALTH CHECK
========================= */
app.get('/', (req, res) => {
  res.send('✅ HabitFlow API is running');
});

/* =========================
   API ROUTES
========================= */
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/habits', habitRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/ai', aiRoutes);

/* =========================
   404 HANDLER
========================= */
app.use((req, res) => {
  console.log('❌ No route:', req.method, req.originalUrl);
  res.status(404).json({ success: false, message: 'Route not found' });
});

/* =========================
   EMAIL CONFIG
========================= */
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/* =========================
   EMAIL REMINDER
========================= */
async function sendHabitEmailReminder(habit, userEmail, time) {
  if (!userEmail) return;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: userEmail,
      subject: `Habit Reminder: ${habit.title}`,
      text: `Hi 👋

It's time for your habit: "${habit.title}" at ${time}

Keep going 💪
— HabitFlow`,
    });

    console.log(`📧 Email sent to ${userEmail}`);
  } catch (err) {
    console.error('❌ Email error:', err.message);
  }
}

/* =========================
   CRON JOB (EVERY MINUTE)
========================= */
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);
    const today = now.toISOString().slice(0, 10);

    const habits = await Habit.find({
      isActive: true,
      reminderEnabled: true,
      reminderTime: currentTime,
      $or: [{ lastReminderDate: null }, { lastReminderDate: { $ne: today } }],
    }).populate('user');

    for (const habit of habits) {
      await sendHabitEmailReminder(
        habit,
        habit.user?.email,
        currentTime
      );
      habit.lastReminderDate = today;
      await habit.save();
    }
  } catch (err) {
    console.error('❌ CRON ERROR:', err);
  }
});

/* =========================
   START SERVER (AZURE)
========================= */
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🚀 HabitFlow API running on port ${PORT}`);
});
