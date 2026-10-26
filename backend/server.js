'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express      = require('express');
const path         = require('path');
const session      = require('express-session');
const cookieParser = require('cookie-parser');
const cors         = require('cors');

// Routes
const trackingRoutes  = require('./routes/trackingRoutes');
const shipmentRoutes  = require('./routes/shipmentRoutes');
const authRoutes      = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const { healthCheck } = require('./controllers/healthController');

// Middleware
const { errorHandler, notFound } = require('./middleware/errorMiddleware');

const app  = express();
const PORT = Number(process.env.PORT) || 3000;

// ── CORS — works locally AND on Vercel ────────────────────────────────────
const allowedOrigins = [
  `http://localhost:${PORT}`,
  'http://localhost:3000',
  process.env.VERCEL_URL   ? `https://${process.env.VERCEL_URL}`   : null,
  process.env.FRONTEND_URL ? process.env.FRONTEND_URL               : null
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || process.env.NODE_ENV === 'development') return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Session ────────────────────────────────────────────────────────────────
app.use(session({
  name:   'courier.sid',
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge:   2 * 60 * 60 * 1000  // 2 hours
  }
}));

// ── Serve static frontend files ────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ── API Routes ─────────────────────────────────────────────────────────────
app.get('/api/health',     healthCheck);
app.use('/api/track',      trackingRoutes);
app.use('/api/shipments',  shipmentRoutes);
app.use('/api/auth',       authRoutes);
app.use('/api/dashboard',  dashboardRoutes);

// ── HTML page routes ───────────────────────────────────────────────────────
app.get('/track', (req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'track.html')));
app.get('/book',  (req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'book.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'login.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'admin.html')));

// ── Error handling ─────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start server (skipped on Vercel — it calls the exported app directly) ──
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n🚀  Courier Tracking System is running`);
    console.log(`    Local:   http://localhost:${PORT}`);
    console.log(`    Health:  http://localhost:${PORT}/api/health`);
    console.log(`    Env:     ${process.env.NODE_ENV || 'development'}\n`);
  });
}

module.exports = app; // required by Vercel + tests
