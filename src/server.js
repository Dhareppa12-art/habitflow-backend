require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/db');

const cron = require('node-cron');
const nodemailer = require('nodemailer');
const Habit = require('./models/Habit');

const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const habitRoutes = require('./routes/habitRoutes');
const statsRoutes = require('./routes/statsRoutes');
const calendarRoutes = require('./routes/calendarRoutes');
const supportRoutes = require('./routes/supportRoutes');
const aiRoutes = require('./routes/aiRoutes');

const app = express();

// ✅ Connect to DB
connectDB();

// ✅ JSON body parser
app.use(express.json());

// 🔍 Log all incoming URLs (for debugging)
app.use((req, res, next) => {
  console.log(
    '➡️ Incoming:',
    req.method,
    req.originalUrl,
    'origin:',
    req.headers.origin
  );
  next();
});

// ✅ CORS configuration (LOCAL + RENDER)
const allowedOrigins = [
  'http://localhost:4200', // local Angular
  'https://habitflow-frontend-hm9x.onrender.com', // deployed Angular
  process.env.CLIENT_URL, // fallback (if set)
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // allow non-browser tools like Postman (no origin header)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log(' CORS blocked origin:', origin);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ✅ Handle preflight for all routes
app.options('*', cors());

// ✅ HTTP logger
app.use(morgan('dev'));

// ✅ Health check route
app.get('/', (req, res) => {
  res.send('HabitFlow API is running');
});

// ✅ API Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/habits', habitRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/ai', aiRoutes);

// ✅ 404 handler
app.use((req, res) => {
  console.log(' No route matched for:', req.method, req.originalUrl);
  res.status(404).json({ success: false, message: 'Route not found' });
});

// -------------------------------------------------
// ✉️ Nodemailer transporter using Gmail App Password
// -------------------------------------------------
const mailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // your Gmail
    pass: process.env.EMAIL_PASS, // 16-digit app password (no spaces)
  },
});

// helper to send reminder email
async function sendHabitEmailReminder(habit, userEmail, time) {
  if (!userEmail) {
    console.log('No email set for user', habit.user);
    return;
  }

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: userEmail,
    subject: `Habit reminder: ${habit.title}`,
    text: `Hi,

It's time for your habit: "${habit.title}" at ${time}.

Keep your streak going! 

— HabitFlow`,
  };

  try {
    await mailTransporter.sendMail(mailOptions);
    console.log(`📧 Email sent to ${userEmail} for habit "${habit.title}"`);
  } catch (err) {
    console.error('EMAIL SEND ERROR:', err.message || err);
  }
}

// -------------------------------------------------
//  REMINDER CRON – runs every minute
// -------------------------------------------------
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${hours}:${minutes}`; // "HH:mm"

    const today = now.toISOString().slice(0, 10); // "YYYY-MM-DD"

    // find all habits that need reminder now
    const habitsToRemind = await Habit.find({
      isActive: true,
      reminderEnabled: true,
      reminderTime: currentTime,
      $or: [{ lastReminderDate: null }, { lastReminderDate: { $ne: today } }],
    }).populate('user'); // get user email

    if (!habitsToRemind.length) return;

    for (const habit of habitsToRemind) {
      const user = habit.user;
      const userEmail = user && user.email ? user.email : null;

      // 1) Log in server
      console.log(
        `⏰ Reminder: Habit "${habit.title}" for user ${habit.user} at ${currentTime}`
      );

      // 2) Send email
      await sendHabitEmailReminder(habit, userEmail, currentTime);

      // 3) Mark as reminded today so we don't spam
      habit.lastReminderDate = today;
      await habit.save();
    }
  } catch (err) {
    console.error('REMINDER CRON ERROR', err);
  }
});

// ✅ Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(` Server running on port ${PORT}`));
