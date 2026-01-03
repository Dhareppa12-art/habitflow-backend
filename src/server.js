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

/* =========================
   CONNECT DATABASE
========================= */
connectDB();

/* =========================
   MIDDLEWARES
========================= */
app.use(express.json());

// Debug incoming requests
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

/* =========================
   CORS CONFIG (AZURE SAFE)
========================= */
const allowedOrigins = [
  'http://localhost:4200', // Local Angular
  'https://habitflow-frontend-hm9x.onrender.com', // Render frontend
  process.env.CLIENT_URL, // Azure / future frontend
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow Postman, Azure probes, server-to-server
      if (!origin) return callback(null, true);

      // Allow known frontends
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Allow Azure internal traffic
      if (origin.includes('azurewebsites.net')) {
        return callback(null, true);
      }

      // TEMP SAFE FALLBACK (prevents app crash)
      console.log('⚠️ CORS allowed temporarily for:', origin);
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Preflight support
app.options('*', cors());

/* =========================
   LOGGING
========================= */
app.use(morgan('dev'));

/* =========================
   HEALTH CHECK
========================= */
app.get('/', (req, res) => {
  res.send('HabitFlow API is running');
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
  console.log('❌ No route matched:', req.method, req.originalUrl);
  res.status(404).json({ success: false, message: 'Route not found' });
});

/* =========================
   EMAIL CONFIG
========================= */
const mailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendHabitEmailReminder(habit, userEmail, time) {
  if (!userEmail) return;

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: userEmail,
    subject: `Habit reminder: ${habit.title}`,
    text: `Hi,

It's time for your habit "${habit.title}" at ${time}.

Keep your streak going!

— HabitFlow`,
  };

  try {
    await mailTransporter.sendMail(mailOptions);
    console.log(`📧 Email sent to ${userEmail}`);
  } catch (err) {
    console.error('EMAIL ERROR:', err.message);
  }
}

/* =========================
   CRON JOB (EVERY MINUTE)
========================= */
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;

    const today = now.toISOString().slice(0, 10);

    const habitsToRemind = await Habit.find({
      isActive: true,
      reminderEnabled: true,
      reminderTime: currentTime,
      $or: [{ lastReminderDate: null }, { lastReminderDate: { $ne: today } }],
    }).populate('user');

    for (const habit of habitsToRemind) {
      const userEmail = habit.user?.email;
      await sendHabitEmailReminder(habit, userEmail, currentTime);
      habit.lastReminderDate = today;
      await habit.save();
    }
  } catch (err) {
    console.error('CRON ERROR:', err);
  }
});

/* =========================
   START SERVER (AZURE READY)
========================= */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`✅ HabitFlow API running on port ${PORT}`)
);
