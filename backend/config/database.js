'use strict';
const { Pool } = require('pg');
const logger = require('../utils/logger');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  max: 20,
  min: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 30000,   // Kill runaway queries after 30s
});

pool.on('connect', () => logger.debug('New DB client connected'));
pool.on('error', (err) => logger.error('Idle DB client error', { error: err.message }));

// Simple query
const query = (text, params) => pool.query(text, params);

// Transaction helper — usage: await withTransaction(async (client) => { ... })
const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// Health check — used in /health endpoint
const healthCheck = async () => {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT NOW() as time, current_database() as db');
    return { status: 'ok', db: result.rows[0].db, time: result.rows[0].time };
  } finally {
    client.release();
  }
};

// Audit log helper
const audit = (gymId, actorId, actorRole, action, entity, entityId, oldData, newData, ip, requestId) =>
  query(
    `INSERT INTO audit_logs (gym_id, actor_id, actor_role, action, entity, entity_id, old_data, new_data, ip_address, request_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [gymId, actorId, actorRole, action, entity, entityId,
     oldData ? JSON.stringify(oldData) : null,
     newData ? JSON.stringify(newData) : null,
     ip, requestId]
  ).catch(err => logger.error('Audit log failed', { error: err.message })); // never throw

module.exports = { query, withTransaction, healthCheck, audit, pool, expireSubscriptions };

// ── Auto-expire subscriptions past end_date ───────────────────
// Call this on startup and periodically (e.g. every hour)
async function expireSubscriptions() {
  try {
    const result = await query(
      `UPDATE subscriptions
       SET status = 'expired', updated_at = NOW()
       WHERE status = 'active' AND end_date < CURRENT_DATE
       RETURNING id`
    );
    if (result.rowCount > 0) {
      const logger = require('../utils/logger');
      logger.info('Auto-expired subscriptions', { count: result.rowCount });
    }
    return result.rowCount;
  } catch (err) {
    const logger = require('../utils/logger');
    logger.warn('expireSubscriptions failed', { error: err.message });
    return 0;
  }
}

