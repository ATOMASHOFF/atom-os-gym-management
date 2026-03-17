'use strict';
const REQUIRED = [
  'DATABASE_URL',
  'JWT_SECRET',
];

const OPTIONAL_DEFAULTS = {
  NODE_ENV:      'development',
  PORT:          '5000',
  JWT_EXPIRES_IN:'7d',
  FRONTEND_URL:  'http://localhost:3000',
  LOG_LEVEL:     'info',
  BCRYPT_ROUNDS: '12',
};

function validateEnv() {
  const missing = REQUIRED.filter(k => !process.env[k]);
  if (missing.length) {
    console.error(`\n❌  FATAL: Missing required environment variables:\n   ${missing.join('\n   ')}\n`);
    process.exit(1);
  }

  // JWT_SECRET must be at least 32 chars
  if (process.env.JWT_SECRET.length < 32) {
    console.error('\n❌  FATAL: JWT_SECRET must be at least 32 characters long.\n');
    process.exit(1);
  }

  // Apply defaults for optional vars
  Object.entries(OPTIONAL_DEFAULTS).forEach(([k, v]) => {
    if (!process.env[k]) process.env[k] = v;
  });

  console.log(`✅  Env validated. NODE_ENV=${process.env.NODE_ENV}`);
}

module.exports = { validateEnv };
