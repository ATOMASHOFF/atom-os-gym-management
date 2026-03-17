#!/usr/bin/env node
'use strict';
/**
 * Database migration runner
 * Usage: node scripts/migrate.js
 *        npm run migrate
 */
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🔄  Running migrations...\n');

    // Ensure migration tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id        SERIAL PRIMARY KEY,
        filename  VARCHAR(255) UNIQUE NOT NULL,
        run_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const migrationsDir = path.join(__dirname, '../config');
    const files = ['schema.sql', 'migration_qr.sql']
      .filter(f => fs.existsSync(path.join(migrationsDir, f)));

    for (const file of files) {
      const already = await client.query(
        'SELECT id FROM _migrations WHERE filename = $1', [file]
      );
      if (already.rows.length) {
        console.log(`  ✅  ${file} (already applied)`);
        continue;
      }
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`  ✅  ${file} (applied)`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    console.log('\n🎉  Migrations complete.\n');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error('\n❌  Migration failed:', err.message);
  process.exit(1);
});
