const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const connectDB = require('./config/db');

const authRoutes        = require('./routes/auth');
const issueRoutes       = require('./routes/issues');
const aiRoutes          = require('./routes/ai');
const analyticsRoutes   = require('./routes/analytics');
const userRoutes        = require('./routes/users');
const departmentRoutes  = require('./routes/departments'); // ← NEW

// ── Smart Drain Monitoring + Drain Echo ──
const drainRoutes          = require('./routes/drains');
const alertRoutes          = require('./routes/alerts');
const drainIncidentRoutes  = require('./routes/drainIncidents');
const drainEchoRoutes      = require('./routes/drainEcho');

const app = express();

connectDB();

// ── CORS ──────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) return callback(null, true);
    if (
      allowedOrigins.some(u => origin === u) ||
      origin.includes('.onrender.com') ||
      origin.includes('.netlify.app') ||
      origin.includes('.vercel.app')
    ) return callback(null, true);
    if (process.env.NODE_ENV === 'production') return callback(null, true);
    callback(new Error('CORS blocked: ' + origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.options('*', cors());

// ── WhatsApp webhook: MUST be mounted BEFORE express.json() ──
// It uses express.raw() so Meta's HMAC signature can be verified on the exact bytes.
app.use('/api/webhooks/whatsapp', require('./routes/whatsappWebhook'));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth',        authRoutes);
app.use('/api/issues',      issueRoutes);
app.use('/api/ai',          aiRoutes);
app.use('/api/analytics',   analyticsRoutes);
app.use('/api/users',       userRoutes);
app.use('/api/departments', departmentRoutes); // ← NEW
app.use('/api/chatbot',     require('./routes/chatbot'));
app.use('/api/community',   require('./routes/community')); // ← NEW: citizen work showcase

// ── Smart Drain Monitoring + Drain Echo ──
app.use('/api/drains',    drainRoutes);
app.use('/api/alerts',    alertRoutes);
app.use('/api/incidents', drainIncidentRoutes);
app.use('/api/drain-echo', drainEchoRoutes);

// Optional live regional drain feed (real rainfall from Open-Meteo, no API key).
if (process.env.REGIONAL_DRAIN_LIVE === 'true') {
  try {
    require('./services/regionalDrainFeed').startLive(Number(process.env.REGIONAL_FEED_MINUTES) || 10);
  } catch (err) {
    console.warn('⚠️  Regional drain feed failed to start:', err.message);
  }
}

// Optional dev-only sensor simulator — only starts if explicitly enabled,
// so production/default behavior is completely unaffected.
if (process.env.SENSOR_SIMULATOR === 'true') {
  try {
    require('./utils/sensorSimulator').start();
  } catch (err) {
    console.warn('⚠️  Sensor simulator failed to start:', err.message);
  }
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'SheharSetu API is operational',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
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
