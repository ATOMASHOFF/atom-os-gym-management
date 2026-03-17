#!/usr/bin/env node
'use strict';
/**
 * ATOM FITNESS — Super Admin Setup
 * Run ONCE to create the Mahnwas Technologies platform account.
 *
 * Usage:  node scripts/setupSuperAdmin.js
 * Or:     npm run setup
 */
require('dotenv').config();

// Check env first
if (!process.env.DATABASE_URL) {
  console.error('\n❌  DATABASE_URL not set in .env file\n');
  process.exit(1);
}

const bcrypt = require('bcryptjs');
const readline = require('readline');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000,
});

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(res => rl.question(q, ans => res(ans.trim())));

async function run() {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║   ATOM FITNESS — Super Admin Setup         ║');
  console.log('╚═══════════════════════════════════════════╝\n');

  // Test DB connection
  let client;
  try {
    client = await pool.connect();
    console.log('✅  Database connected\n');
  } catch (err) {
    console.error('❌  Cannot connect to database:', err.message);
    console.error('    Check your DATABASE_URL in .env\n');
    process.exit(1);
  }

  try {
    // Ensure schema exists
    const tableExists = await client.query(
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'super_admins')"
    );
    if (!tableExists.rows[0].exists) {
      console.error('❌  Tables not created yet. Run: npm run migrate\n');
      process.exit(1);
    }

    // Check existing super admins
    const existing = await client.query('SELECT id, name, email FROM super_admins WHERE is_active = true');
    if (existing.rows.length > 0) {
      console.log('ℹ️   Existing super admins:');
      existing.rows.forEach(sa => console.log(`    → ${sa.name} <${sa.email}>`));
      const more = await ask('\nCreate another super admin? (yes/no): ');
      if (more.toLowerCase() !== 'yes' && more.toLowerCase() !== 'y') {
        console.log('\nCancelled. Use existing credentials to log in.\n');
        process.exit(0);
      }
      console.log('');
    }

    // Collect details
    const name  = await ask('Your name: ');
    const email = (await ask('Email address: ')).toLowerCase();

    if (!name || !email || !email.includes('@')) {
      console.error('\n❌  Name and valid email are required\n');
      process.exit(1);
    }

    // Check duplicate email
    const dupCheck = await client.query('SELECT id FROM super_admins WHERE email = $1', [email]);
    if (dupCheck.rows.length) {
      console.error(`\n❌  ${email} is already registered as a super admin\n`);
      process.exit(1);
    }

    const password = await ask('Password (min 12 characters): ');
    if (password.length < 12) {
      console.error('\n❌  Password must be at least 12 characters\n');
      process.exit(1);
    }

    const confirm = await ask('Confirm password: ');
    if (password !== confirm) {
      console.error('\n❌  Passwords do not match\n');
      process.exit(1);
    }

    // Create
    const hash = await bcrypt.hash(password, 12);
    const result = await client.query(
      'INSERT INTO super_admins (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, hash]
    );

    console.log('\n╔═══════════════════════════════════════════════╗');
    console.log('║  ✅  SUPER ADMIN CREATED                       ║');
    console.log('╠═══════════════════════════════════════════════╣');
    console.log(`║  Name:  ${name.padEnd(38)}║`);
    console.log(`║  Email: ${email.padEnd(38)}║`);
    console.log('╚═══════════════════════════════════════════════╝\n');
    console.log('What you can do as super admin:');
    console.log('  ✓  Create and manage all gyms');
    console.log('  ✓  View all members across all gyms');
    console.log('  ✓  Activate or deactivate any gym');
    console.log('  ✓  Reset any gym admin password\n');
    console.log('Log in at http://localhost:3000 — no gym selection needed.\n');

  } catch (err) {
    console.error('\n❌  Failed:', err.message, '\n');
    process.exit(1);
  } finally {
    if (client) client.release();
    rl.close();
    await pool.end();
  }
}

run();
