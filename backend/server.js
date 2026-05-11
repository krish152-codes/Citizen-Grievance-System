const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const connectDB = require('./config/db');

const authRoutes     = require('./routes/auth');
const issueRoutes    = require('./routes/issues');
const aiRoutes       = require('./routes/ai');
const analyticsRoutes = require('./routes/analytics');
const userRoutes     = require('./routes/users');

const app = express();

connectDB();

// ── CORS — works for localhost AND Render deployed URLs ──
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile, curl, Postman)
    if (!origin) return callback(null, true);
    // Allow localhost always
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    // Allow if it matches FRONTEND_URL or onrender.com
    if (
      allowedOrigins.some(u => origin === u) ||
      origin.includes('.onrender.com') ||
      origin.includes('.netlify.app') ||
      origin.includes('.vercel.app')
    ) {
      return callback(null, true);
    }
    // Allow all in production to prevent blocking
    if (process.env.NODE_ENV === 'production') {
      return callback(null, true);
    }
    callback(new Error('CORS blocked: ' + origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.options('*', cors());

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth',      authRoutes);
app.use('/api/issues',    issueRoutes);
app.use('/api/ai',        aiRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/users',     userRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'SheharSetu API is operational',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global Error:', err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 SheharSetu server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  console.log(`📡 Health: http://localhost:${PORT}/api/health`);
});

module.exports = app;