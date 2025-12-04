require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/db');

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
  console.log('➡️ Incoming:', req.method, req.originalUrl, 'origin:', req.headers.origin);
  next();
});

// ✅ CORS configuration (LOCAL + RENDER)
const allowedOrigins = [
  'http://localhost:4200',                          // local Angular
  'https://habitflow-frontend-hm9x.onrender.com',  // deployed Angular
  process.env.CLIENT_URL                            // fallback (if set)
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // allow non-browser tools like Postman (no origin header)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log('❌ CORS blocked origin:', origin);
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
  console.log('❌ No route matched for:', req.method, req.originalUrl);
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ✅ Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
