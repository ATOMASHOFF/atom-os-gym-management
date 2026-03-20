#!/usr/bin/env node
'use strict';
/**
 * ATOM FITNESS — Database Migration + Bootstrap
 *
 * Runs automatically on every server start.
 * Safe to run multiple times — fully idempotent.
 *
 * What this does:
 *  1. Creates all tables and indexes
 *  2. Applies any missing columns to existing databases
 *  3. Creates the default "Atom OS" gym (gym_id = 1)
 *  4. Creates the super admin account from env vars
 *  5. Back-fills QR tokens and member codes
 *
 * Env vars for bootstrap (set these in Railway/Render):
 *   SUPER_ADMIN_NAME     — your name (default: "Super Admin")
 *   SUPER_ADMIN_EMAIL    — your email (REQUIRED for auto-create)
 *   SUPER_ADMIN_PASSWORD — your password (REQUIRED for auto-create)
 *   DEFAULT_GYM_NAME     — platform gym name (default: "Atom OS")
 */
require('dotenv').config();

if (!process.env.DATABASE_URL) {
  console.error('\n❌  DATABASE_URL not set in .env\n');
  process.exit(1);
}

const { Pool }  = require('pg');
const bcrypt    = require('bcryptjs');
const crypto    = require('crypto');
const fs        = require('fs');
const path      = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 15000,
});

// ── Schema patches — safe on any existing database ───────────
const PATCHES = [
  // Sequence for atomic member codes
  `CREATE SEQUENCE IF NOT EXISTS member_code_seq START 1 INCREMENT 1`,

  // gyms
  `ALTER TABLE gyms ADD COLUMN IF NOT EXISTS plan     VARCHAR(20) NOT NULL DEFAULT 'starter'`,
  `ALTER TABLE gyms ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Asia/Kolkata'`,
  `ALTER TABLE gyms ADD COLUMN IF NOT EXISTS logo_url TEXT`,

  // members — unique member code (e.g. ATM-000042)
  `ALTER TABLE members ADD COLUMN IF NOT EXISTS member_code       VARCHAR(20) UNIQUE`,
  `ALTER TABLE members ADD COLUMN IF NOT EXISTS last_login_at     TIMESTAMPTZ`,
  `ALTER TABLE members ADD COLUMN IF NOT EXISTS qr_token          VARCHAR(255)`,
  `ALTER TABLE members ADD COLUMN IF NOT EXISTS profile_photo     TEXT`,
  `ALTER TABLE members ADD COLUMN IF NOT EXISTS date_of_birth     DATE`,
  `ALTER TABLE members ADD COLUMN IF NOT EXISTS address           TEXT`,
  `ALTER TABLE members ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(255)`,
  `ALTER TABLE members ADD COLUMN IF NOT EXISTS notes             TEXT`,

  // super_admins
  `CREATE TABLE IF NOT EXISTS super_admins (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active     BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // audit_logs
  `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_type VARCHAR(20) DEFAULT 'member'`,
  `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_role VARCHAR(20)`,
  `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS request_id VARCHAR(36)`,
  `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address INET`,

  // subscriptions
  `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(255)`,
  `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS notes          TEXT`,

  // Indexes
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_members_qr_token   ON members(qr_token)    WHERE qr_token    IS NOT NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_members_code       ON members(member_code) WHERE member_code IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_members_gym_status        ON members(gym_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_members_gym_role          ON members(gym_id, role)`,
  `CREATE INDEX IF NOT EXISTS idx_super_admins_email        ON super_admins(email)`,
  `CREATE INDEX IF NOT EXISTS idx_subs_gym_status           ON subscriptions(gym_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_gym                 ON audit_logs(gym_id, created_at DESC)`,
];

// ── Generate member code from sequential id ──────────────────
function memberCode(id) {
  return 'ATM-' + String(id).padStart(6, '0');
}

async function migrate() {
  const client = await pool.connect();
  console.log('\n🔄  Running ATOM OS migrations...\n');

  try {
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    // Migration tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id       SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        run_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── 1. Apply schema ───────────────────────────────────────
    const schemaPath = path.join(__dirname, '../config/schema.sql');
    if (fs.existsSync(schemaPath)) {
      const already = await client.query(
        `SELECT id FROM _migrations WHERE filename = 'schema.sql'`
      );
      if (!already.rows.length) {
        const sql = fs.readFileSync(schemaPath, 'utf8');
        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query(`INSERT INTO _migrations (filename) VALUES ('schema.sql')`);
          await client.query('COMMIT');
          console.log('  ✅  schema.sql applied');
        } catch (err) {
          await client.query('ROLLBACK');
          console.log('  ⚠️   schema.sql skipped (tables exist) — applying patches');
        }
      } else {
        console.log('  ✅  schema.sql already applied');
      }
    }

    // ── 2. Column patches ─────────────────────────────────────
    let patched = 0;
    for (const sql of PATCHES) {
      try {
        await client.query(sql);
        patched++;
      } catch (err) {
        if (!err.message.includes('already exists') && !err.message.includes('duplicate')) {
          console.warn(`  ⚠️   Patch: ${err.message.split('\n')[0]}`);
        }
      }
    }
    console.log(`  ✅  ${patched} column patches applied`);

    // ── 3. Create default "Atom OS" gym ───────────────────────
    const gymName = process.env.DEFAULT_GYM_NAME || 'Atom OS';
    const gymSlug = gymName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const existingGym = await client.query(
      `SELECT id FROM gyms WHERE id = 1 OR slug = $1 LIMIT 1`, [gymSlug]
    );

    let defaultGymId;
    if (!existingGym.rows.length) {
      const saEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@atomos.in';
      const gymR = await client.query(
        `INSERT INTO gyms (name, slug, owner_name, owner_email, plan, timezone)
         VALUES ($1, $2, 'Mahnwas Technologies', $3, 'enterprise', 'Asia/Kolkata')
         RETURNING id`,
        [gymName, gymSlug, saEmail]
      );
      defaultGymId = gymR.rows[0].id;
      console.log(`  ✅  Default gym "${gymName}" created (id=${defaultGymId})`);
    } else {
      defaultGymId = existingGym.rows[0].id;
      console.log(`  ✅  Default gym "${gymName}" exists (id=${defaultGymId})`);
    }

    // ── 4. Create super admin ─────────────────────────────────
    const saEmail    = process.env.SUPER_ADMIN_EMAIL;
    const saPassword = process.env.SUPER_ADMIN_PASSWORD;
    const saName     = process.env.SUPER_ADMIN_NAME || 'Super Admin';

    if (saEmail && saPassword) {
      const existingSA = await client.query(
        `SELECT id FROM super_admins WHERE email = $1`, [saEmail.toLowerCase()]
      );
      if (!existingSA.rows.length) {
        const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
        const hash   = await bcrypt.hash(saPassword, rounds);
        await client.query(
          `INSERT INTO super_admins (name, email, password_hash)
           VALUES ($1, $2, $3)`,
          [saName, saEmail.toLowerCase(), hash]
        );
        console.log(`  ✅  Super admin created: ${saEmail}`);
      } else {
        console.log(`  ✅  Super admin exists: ${saEmail}`);
      }
    } else {
      console.log('  ℹ️   SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD not set — skipping auto-create');
      console.log('       Run: node scripts/setup to create super admin manually');
    }

    // ── 5. Back-fill QR tokens ────────────────────────────────
    try {
      const qrResult = await client.query(`
        UPDATE members
        SET qr_token = 'MBR-' || id || '-' || upper(substring(encode(gen_random_bytes(8),'hex'),1,16))
        WHERE qr_token IS NULL
        RETURNING id
      `);
      if (qrResult.rowCount > 0) {
        console.log(`  ✅  QR tokens generated for ${qrResult.rowCount} members`);
      }
    } catch (err) {
      console.warn('  ⚠️   QR back-fill:', err.message.split('\n')[0]);
    }

    // ── 6. Back-fill member codes ─────────────────────────────
    try {
      const members = await client.query(
        `SELECT id FROM members WHERE member_code IS NULL ORDER BY id`
      );
      for (const m of members.rows) {
        await client.query(
          `UPDATE members SET member_code = $1 WHERE id = $2`,
          [memberCode(m.id), m.id]
        ).catch(() => {}); // ignore if code already taken
      }
      if (members.rows.length > 0) {
        console.log(`  ✅  Member codes generated for ${members.rows.length} members`);
      }
    } catch (err) {
      console.warn('  ⚠️   Member code back-fill:', err.message.split('\n')[0]);
    }

    console.log('\n🎉  Migration complete!\n');

  } catch (err) {
    console.error('\n❌  Migration failed:', err.message, '\n');
    // Don't exit(1) when called from server startup — let server try to start anyway
    if (require.main === module) process.exit(1);
  } finally {
    client.release();
    if (require.main === module) await pool.end();
  }
}

migrate();
module.exports = { migrate };
