'use strict';
const rateLimit = require('express-rate-limit');
const AppError = require('../utils/AppError');

const make = (options) => rateLimit({
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: options.message || 'Too many requests. Please slow down.',
      retryAfter: Math.ceil(options.windowMs / 1000),
    });
  },
  ...options,
});

// Strict: login, register — 10 attempts per 15 min per IP
const authLimiter = make({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts. Try again in 15 minutes.',
});

// Standard API calls — 300 per minute per IP
const apiLimiter = make({
  windowMs: 60 * 1000,
  max: 300,
  message: 'Request limit exceeded.',
});

// Public endpoints — 30 per minute (registration, gym list)
const publicLimiter = make({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Too many requests from this IP.',
});

// QR scanning — fast: 60 per minute (staff scanning members rapidly)
const scanLimiter = make({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Scan rate limit exceeded.',
});

module.exports = { authLimiter, apiLimiter, publicLimiter, scanLimiter };
