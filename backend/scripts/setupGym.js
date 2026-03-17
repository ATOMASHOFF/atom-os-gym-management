#!/usr/bin/env node
'use strict';
/**
 * ATOM FITNESS — New Gym Setup Script
 * Run this ONCE to create a gym and its first admin account.
 * Usage: node scripts/setupGym.js
 *
 * After this runs, log in as admin and:
 *  1. Complete gym profile in Settings
 *  2. Create membership plans
 *  3. Import members via the Bulk Import tool
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const readline = require('readline');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(res => rl.question(q, res));

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function generatePassword(len = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$';
  return Array.from(crypto.randomBytes(len)).map(b => chars[b % chars.length]).join('');
}

async function setup() {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   ATOM FITNESS — New Gym Setup        ║');
  console.log('╚══════════════════════════════════════╝\n');

  const client = await pool.connect();

  try {
    // Collect gym info
    const gymName     = (await ask('Gym name: ')).trim();
    if (!gymName) { console.error('Gym name is required.'); process.exit(1); }

    const slug = slugify(gymName);
    const ownerName  = (await ask('Owner full name: ')).trim();
    const ownerEmail = (await ask('Owner email: ')).trim().toLowerCase();
    const ownerPhone = (await ask('Owner phone: ')).trim();
    const address    = (await ask('Gym address: ')).trim();

    // Check if gym slug already exists
    const existing = await client.query('SELECT id FROM gyms WHERE slug = $1', [slug]);
    if (existing.rows.length) {
      console.error(`\n❌  A gym with slug "${slug}" already exists. Choose a different name.\n`);
      process.exit(1);
    }

    const adminPassword = generatePassword();
    const adminHash = await bcrypt.hash(adminPassword, 12);
    const adminQR = 'MBR-A-' + crypto.randomBytes(8).toString('hex').toUpperCase();

    console.log('\n📋  Review before creating:\n');
    console.log(`  Gym:    ${gymName}`);
    console.log(`  Slug:   ${slug}`);
    console.log(`  Owner:  ${ownerName} <${ownerEmail}>`);
    console.log(`  Phone:  ${ownerPhone}`);
    console.log(`  Addr:   ${address}`);
    console.log(`\n  Admin login will be:`);
    console.log(`  Email:    ${ownerEmail}`);
    console.log(`  Password: ${adminPassword}  ← save this!\n`);

    const confirm = (await ask('Create gym? (yes/no): ')).trim().toLowerCase();
    if (confirm !== 'yes' && confirm !== 'y') {
      console.log('\nCancelled.\n');
      process.exit(0);
    }

    // Run in transaction
    await client.query('BEGIN');
    const gymR = await client.query(
      `INSERT INTO gyms (name, slug, owner_name, owner_email, owner_phone, address)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [gymName, slug, ownerName, ownerEmail, ownerPhone, address]
    );
    const gymId = gymR.rows[0].id;

    await client.query(
      `INSERT INTO members (name, email, phone, password_hash, role, gym_id, status, qr_token)
       VALUES ($1, $2, $3, $4, 'admin', $5, 'active', $6)`,
      [ownerName, ownerEmail, ownerPhone, adminHash, gymId, adminQR]
    );
    await client.query('COMMIT');

    console.log('\n✅  Gym created successfully!\n');
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║  SAVE THESE CREDENTIALS — shown only once    ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log(`║  Email:    ${ownerEmail.padEnd(34)}║`);
    console.log(`║  Password: ${adminPassword.padEnd(34)}║`);
    console.log('╚══════════════════════════════════════════════╝\n');
    console.log('Next steps:');
    console.log('  1. Log in at your app URL');
    console.log('  2. Go to Settings → complete your gym profile');
    console.log('  3. Go to Plans → create your membership plans');
    console.log('  4. Go to Members → Import → upload your member list (Excel/CSV)\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌  Setup failed:', err.message, '\n');
    process.exit(1);
  } finally {
    client.release();
    rl.close();
    await pool.end();
  }
}

setup();
