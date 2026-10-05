const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const mongoose = require('mongoose');

// Load environment variables strictly from server/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { connectDB } = require('./config/db');
const { getJwtSecret } = require('./config/jwt');
const authRoutes = require('./routes/authRoutes');
const noteRoutes = require('./routes/noteRoutes');
const quizRoutes = require('./routes/quizRoutes');
const flashcardRoutes = require('./routes/flashcardRoutes');
const plannerRoutes = require('./routes/plannerRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const questionRoutes = require('./routes/questionRoutes');
const askRoutes = require('./routes/askRoutes');

const helmet = require('helmet');

// Ensure JWT_SECRET is configured before starting the application
try {
  getJwtSecret();
} catch (jwtErr) {
  console.error('[StudyMate Fatal Error]:', jwtErr.message);
  process.exit(1);
}

const app = express();

// Trust reverse proxy (Render, Railway, etc.) so rate limiters inspect true client IP
app.set('trust proxy', 1);

// Apply Security Headers via Helmet
app.use(helmet());

// Configure CORS using CLIENT_URL (supports comma-separated origins) + dev default localhost:5173
const rawClientUrls = process.env.CLIENT_URL || '';
const configuredOrigins = rawClientUrls
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

const isDev = process.env.NODE_ENV !== 'production';

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    const normalizedOrigin = origin.replace(/\/$/, '');
    if (configuredOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    if (isDev) {
      if (
        normalizedOrigin === 'http://localhost:5173' ||
        normalizedOrigin === 'http://127.0.0.1:5173' ||
        /^http:\/\/localhost:\d+$/.test(normalizedOrigin) ||
        /^http:\/\/127\.0\.0\.1:\d+$/.test(normalizedOrigin)
      ) {
        return callback(null, true);
      }
    }

    const corsError = new Error(`CORS blocked request from origin: ${origin}`);
    corsError.status = 403;
    corsError.statusCode = 403;
    corsError.isCors = true;
    return callback(corsError);
  },
  credentials: true,
}));

// Body limits reduced to 1mb for security (file uploads up to 15MB handled by multer)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'StudyMate API Server',
    timestamp: new Date().toISOString(),
    db: mongoose.connection.readyState === 1,
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here'),
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/flashcards', flashcardRoutes);
app.use('/api/planner', plannerRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/ask', askRoutes);

// JSON 404 handler for unknown /api routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: true, message: 'Route not found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Global Error Handler]:', err);

  if (err.isCors || err.status === 403 || (err.message && err.message.includes('CORS blocked'))) {
    return res.status(403).json({ error: true, message: err.message || 'Not allowed by CORS' });
  }

  if (err.name === 'MulterError') {
    return res.status(400).json({ error: true, message: `Upload error: ${err.message}` });
  }

  if (
    err.message &&
    (err.message.includes('Invalid file format') ||
      err.message.includes('readable text') ||
      err.message.includes('scanned') ||
      err.message.includes('empty'))
  ) {
    return res.status(400).json({ error: true, message: err.message });
  }

  const status = err.status || err.statusCode || 500;
  const isProd = process.env.NODE_ENV === 'production';
  const message = (status === 500 && isProd)
    ? 'An unexpected internal error occurred.'
    : (err.message || 'An unexpected internal error occurred.');

  res.status(status).json({
    error: true,
    message,
  });
});

const PORT = process.env.PORT || 5000;

const seedDemoUser = async () => {
  // Demo user seeding disabled in production
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  try {
    const User = require('./models/User');
    const existing = await User.findOne({ email: 'student@studymate.ai' });
    if (!existing) {
      await User.create({
        name: 'Alex Morgan',
        email: 'student@studymate.ai',
        password: 'studyhard123',
      });
      console.log('[Seed] Demo student account ready: student@studymate.ai');
    }
  } catch (err) {
    console.warn('[Seed] Notice:', err.message);
  }
};

// Connect Database and Start Server when executed directly
if (require.main === module) {
  connectDB()
    .then(async () => {
      await seedDemoUser();
      app.listen(PORT, () => {
        console.log(`[StudyMate Server] Running at http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      console.error('[StudyMate Server] Database connection error:', err);
      process.exit(1);
    });
}

module.exports = app;
