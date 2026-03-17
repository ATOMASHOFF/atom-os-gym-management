'use strict';
require('dotenv').config();

// Must validate env before anything else
const { validateEnv } = require('./config/env');
validateEnv();

const express  = require('express');
const helmet   = require('helmet');
const cors     = require('cors');
const morgan   = require('morgan');
const compress = require('compression');
const logger   = require('./utils/logger');
const { healthCheck, pool } = require('./config/database');
const requestId = require('./middleware/requestId');
const { apiLimiter } = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');

const app  = express();
const PORT = parseInt(process.env.PORT || '5000');

// ── Security headers ────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  hsts: process.env.NODE_ENV === 'production'
    ? { maxAge: 31536000, includeSubDomains: true }
    : false,
}));

// ── CORS ─────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://atom-fitness-app.onrender.com',
  ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:3000', 'http://localhost:3001'] : []),
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    logger.warn('CORS blocked request', { origin });
    cb(new Error(`CORS policy: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-ID'],
}));

// ── Compression (FIX [12]) ───────────────────────────────────
app.use(compress());

// ── Body parsing — FIX [3]: 100kb max (not 10mb) ────────────
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// ── Request ID (FIX [13]) ────────────────────────────────────
app.use(requestId);

// ── Structured HTTP logging (FIX [9]) ────────────────────────
app.use(morgan(
  ':method :url :status :res[content-length] - :response-time ms',
  { stream: { write: (msg) => logger.http(msg.trim()) } }
));

// ── Global rate limit (FIX [1]) ─────────────────────────────
app.use('/api', apiLimiter);

// ── Routes ───────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/members',       require('./routes/members'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/attendance',    require('./routes/attendance'));
app.use('/api/staff',         require('./routes/staff'));
app.use('/api/plans',         require('./routes/plans'));
app.use('/api/gym-qr',        require('./routes/gymQR'));
app.use('/api/gyms',          require('./routes/gyms'));
app.use('/api/public',        require('./routes/public'));
app.use('/api/super',          require('./routes/super'));
app.use('/api/import',        require('./routes/import'));
app.use('/api/scan',          require('./routes/scan'));

// ── Health check — FIX [19]: includes DB ping ────────────────
app.get('/health', async (req, res) => {
  try {
    const db = await healthCheck();
    res.json({ status: 'ok', db, uptime: process.uptime(), timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'degraded', error: 'DB unreachable', timestamp: new Date().toISOString() });
  }
});

app.get('/', (req, res) => res.json({ name: 'ATOM FITNESS API', version: '2.0.0', status: 'running' }));

// ── 404 handler ──────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found`, code: 'NOT_FOUND' });
});

// ── Central error handler (FIX [15]) ────────────────────────
app.use(errorHandler);

// ── Graceful shutdown (FIX [8]) ──────────────────────────────
const server = app.listen(PORT, () => {
  logger.info(`🏋️  ATOM FITNESS API started`, {
    port: PORT,
    env: process.env.NODE_ENV,
    nodeVersion: process.version,
  });
});

const shutdown = async (signal) => {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close(async () => {
    logger.info('HTTP server closed');
    await pool.end();
    logger.info('DB pool closed');
    process.exit(0);
  });
  // Force exit after 10s
  setTimeout(() => { logger.error('Forced exit after timeout'); process.exit(1); }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException',  (err) => { logger.error('Uncaught exception', { error: err.message, stack: err.stack }); process.exit(1); });
process.on('unhandledRejection', (err) => { logger.error('Unhandled rejection', { error: err?.message, stack: err?.stack }); process.exit(1); });

module.exports = app; // for testing
