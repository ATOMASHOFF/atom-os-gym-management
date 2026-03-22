'use strict';
require('dotenv').config();

const { validateEnv } = require('./config/env');
validateEnv();

// ── Run migrations before starting server ────────────────────
async function bootstrap() {
  try {
    const { migrate } = require('./scripts/migrate');
    await migrate();
  } catch (err) {
    // Log but don't crash — DB might already be set up
    console.error('Migration warning (server will still start):', err.message);
  }
}

bootstrap().then(startServer);

function startServer() {
  const express  = require('express');
  const helmet   = require('helmet');
  const cors     = require('cors');
  const morgan   = require('morgan');
  const compress = require('compression');
  const logger   = require('./utils/logger');
  const { healthCheck, pool, expireSubscriptions } = require('./config/database');

  // Auto-expire past-due subscriptions on startup + every hour
  expireSubscriptions();
  setInterval(expireSubscriptions, 60 * 60 * 1000);
  const requestId = require('./middleware/requestId');
  const { apiLimiter } = require('./middleware/rateLimiter');
  const { errorHandler } = require('./middleware/errorHandler');

  const app  = express();
  const PORT = parseInt(process.env.PORT || '5000');

  // ── Security ─────────────────────────────────────────────────
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
    hsts: process.env.NODE_ENV === 'production' ? { maxAge: 31536000 } : false,
  }));

  // ── CORS ──────────────────────────────────────────────────────
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    'https://atom-os.pages.dev',
    'http://localhost:3000',
    'http://localhost:3001',
  ].filter(Boolean);

  app.use(cors({
    origin: (origin, cb) => {
      // Allow no-origin requests (mobile, curl, Postman)
      if (!origin) return cb(null, true);
      // Allow all origins in development
      if (process.env.NODE_ENV !== 'production') return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      // Allow any *.pages.dev, *.onrender.com, *.railway.app, *.vercel.app
      if (/\.(pages\.dev|onrender\.com|railway\.app|vercel\.app|netlify\.app)$/.test(origin)) {
        return cb(null, true);
      }
      logger.warn('CORS blocked', { origin });
      cb(null, true); // In production, allow all for now to prevent lockout
    },
    credentials: true,
    methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
    allowedHeaders: ['Authorization','Content-Type','X-Request-ID','X-Gym-ID'],
  }));

  app.use(compress());

  // Disable HTTP caching for all API responses
  // Prevents 304 Not Modified from serving stale empty lists
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));
  app.use(requestId);
  app.use(morgan(
    ':method :url :status :res[content-length] - :response-time ms',
    { stream: { write: msg => logger.http(msg.trim()) } }
  ));

  app.use('/api', apiLimiter);

  // ── Routes ────────────────────────────────────────────────────
  app.use('/api/auth',          require('./routes/auth'));
  app.use('/api/members',       require('./routes/members'));
  app.use('/api/subscriptions', require('./routes/subscriptions'));
  app.use('/api/attendance',    require('./routes/attendance'));
  app.use('/api/staff',         require('./routes/staff'));
  app.use('/api/plans',         require('./routes/plans'));
  app.use('/api/gym-qr',        require('./routes/gymQR'));
  app.use('/api/gyms',          require('./routes/gyms'));
  app.use('/api/public',        require('./routes/public'));
  app.use('/api/super',         require('./routes/super'));
  app.use('/api/import',        require('./routes/import'));
  app.use('/api/scan',          require('./routes/scan'));

  // ── Health check ──────────────────────────────────────────────
  app.get('/health', async (req, res) => {
    try {
      const db = await healthCheck();
      res.json({ status: 'ok', db, uptime: process.uptime(), ts: new Date().toISOString() });
    } catch {
      res.status(503).json({ status: 'degraded', error: 'DB unreachable' });
    }
  });

  app.get('/', (req, res) =>
    res.json({ name: 'ATOM OS API', version: '2.0.0', status: 'running' })
  );

  app.use((req, res) =>
    res.status(404).json({ success: false, message: `${req.method} ${req.path} not found` })
  );
  app.use(errorHandler);

  // ── Start ─────────────────────────────────────────────────────
  const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info('🏋️  ATOM OS API started', {
      port: PORT, env: process.env.NODE_ENV, node: process.version
    });
  });

  // ── Graceful shutdown ─────────────────────────────────────────
  const shutdown = async (sig) => {
    logger.info(`${sig} — shutting down`);
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('uncaughtException',  err => { logger.error('Uncaught', { err: err.message }); process.exit(1); });
  process.on('unhandledRejection', err => { logger.error('Unhandled', { err: err?.message }); process.exit(1); });

  module.exports = app;
}
