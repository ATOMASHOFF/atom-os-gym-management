#!/usr/bin/env node
'use strict';
/**
 * Demo data seeder — DO NOT run against production
 * Usage: node scripts/seed.js
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

if (process.env.NODE_ENV === 'production') {
  console.error('❌  Refusing to seed production database.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const GYMS = [
  { name: 'ATOM Fitness', slug: 'atom-fitness', owner_name: 'Ashish Kumar', owner_email: 'ashish@atomfitness.com', owner_phone: '+91-9876543210', address: 'Rohini, North Delhi' },
  { name: 'PowerHouse Gym', slug: 'powerhouse', owner_name: 'Raj Malhotra', owner_email: 'raj@powerhouse.com', owner_phone: '+91-9876543211', address: 'Andheri West, Mumbai' },
];

const BCRYPT_ROUNDS = 10; // faster for seeding

async function seed() {
  const client = await pool.connect();
  console.log('🌱  Seeding database...\n');
  try {
    for (const gym of GYMS) {
      // Upsert gym
      const gymR = await client.query(
        `INSERT INTO gyms (name,slug,owner_name,owner_email,owner_phone,address)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
        [gym.name, gym.slug, gym.owner_name, gym.owner_email, gym.owner_phone, gym.address]
      );
      const gymId = gymR.rows[0].id;
      console.log(`  🏋️  ${gym.name} (id=${gymId})`);

      const adminHash = await bcrypt.hash('Admin@123', BCRYPT_ROUNDS);
      const staffHash = await bcrypt.hash('Staff@123', BCRYPT_ROUNDS);
      const memberHash = await bcrypt.hash('Member@123', BCRYPT_ROUNDS);

      // Admin
      const adminQR = 'MBR-A-' + crypto.randomBytes(8).toString('hex').toUpperCase();
      const admin = await client.query(
        `INSERT INTO members (name,email,phone,password_hash,role,gym_id,status,qr_token)
         VALUES ($1,$2,$3,$4,'admin',$5,'active',$6)
         ON CONFLICT (email,gym_id) DO UPDATE SET password_hash=EXCLUDED.password_hash RETURNING id`,
        [gym.owner_name, `admin@${gym.slug}.com`, gym.owner_phone, adminHash, gymId, adminQR]
      );
      console.log(`     👤  Admin: admin@${gym.slug}.com / Admin@123`);

      // Staff
      const staffQR = 'MBR-S-' + crypto.randomBytes(8).toString('hex').toUpperCase();
      const staff = await client.query(
        `INSERT INTO members (name,email,phone,password_hash,role,gym_id,status,qr_token)
         VALUES ('Staff Member',$1,'+91-9999999990',$2,'staff',$3,'active',$4)
         ON CONFLICT (email,gym_id) DO UPDATE SET password_hash=EXCLUDED.password_hash RETURNING id`,
        [`staff@${gym.slug}.com`, staffHash, gymId, staffQR]
      );
      await client.query(
        `INSERT INTO staff_permissions (staff_id,gym_id,can_scan_attendance,can_view_members,can_view_attendance,can_view_subscriptions)
         VALUES ($1,$2,true,true,true,true) ON CONFLICT DO NOTHING`,
        [staff.rows[0].id, gymId]
      );
      console.log(`     👤  Staff: staff@${gym.slug}.com / Staff@123`);

      // Plans
      const PLANS = [
        { name: 'Monthly',    days: 30,  price: 800  },
        { name: 'Quarterly',  days: 90,  price: 2100 },
        { name: 'Half Yearly',days: 180, price: 3600 },
        { name: 'Annual',     days: 365, price: 6000 },
      ];
      const planIds = [];
      for (const p of PLANS) {
        const pr = await client.query(
          `INSERT INTO membership_plans (gym_id,name,duration_days,price)
           VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING id`,
          [gymId, p.name, p.days, p.price]
        );
        if (pr.rows.length) planIds.push({ id: pr.rows[0].id, ...p });
      }

      // 10 members with realistic data
      let checkinCount = 0;
      for (let i = 1; i <= 10; i++) {
        const memberQR = 'MBR-' + i + '-' + crypto.randomBytes(8).toString('hex').toUpperCase();
        const m = await client.query(
          `INSERT INTO members (name,email,phone,password_hash,role,gym_id,status,qr_token)
           VALUES ($1,$2,$3,$4,'member',$5,'active',$6)
           ON CONFLICT (email,gym_id) DO UPDATE SET password_hash=EXCLUDED.password_hash RETURNING id`,
          [`Test Member ${i}`, `member${i}@${gym.slug}.com`, `+91-9876${String(i).padStart(6,'0')}`, memberHash, gymId, memberQR]
        );
        const memberId = m.rows[0].id;

        if (planIds.length) {
          const plan = planIds[(i - 1) % planIds.length];
          const start = new Date();
          start.setDate(start.getDate() - Math.floor(Math.random() * 60));
          const end = new Date(start);
          end.setDate(end.getDate() + plan.days);
          const status = end >= new Date() ? 'active' : 'expired';

          const sub = await client.query(
            `INSERT INTO subscriptions (member_id,plan_id,gym_id,start_date,end_date,status,payment_method,amount_paid)
             VALUES ($1,$2,$3,$4,$5,$6,'cash',$7) ON CONFLICT DO NOTHING RETURNING id`,
            [memberId, plan.id, gymId, start.toISOString().split('T')[0], end.toISOString().split('T')[0], status, plan.price]
          );

          // Attendance history
          if (sub.rows.length) {
            for (let d = 1; d <= 20; d++) {
              if (Math.random() > 0.4) {
                const date = new Date();
                date.setDate(date.getDate() - d);
                const ds = date.toISOString().split('T')[0];
                try {
                  await client.query(
                    `INSERT INTO attendance_logs (member_id,subscription_id,gym_id,check_in_time,check_in_date,scan_method)
                     VALUES ($1,$2,$3,$4,$5,$6)`,
                    [memberId, sub.rows[0].id, gymId, date, ds, Math.random() > 0.5 ? 'qr' : 'manual']
                  );
                  checkinCount++;
                } catch (_) {}
              }
            }
          }
        }
      }

      // 3 pending members
      for (let i = 1; i <= 3; i++) {
        const pqr = 'MBR-P-' + crypto.randomBytes(8).toString('hex').toUpperCase();
        await client.query(
          `INSERT INTO members (name,email,phone,password_hash,role,gym_id,status,qr_token)
           VALUES ($1,$2,'+91-1111111111',$3,'member',$4,'pending',$5)
           ON CONFLICT DO NOTHING`,
          [`Pending Member ${i}`, `pending${i}@${gym.slug}.com`, memberHash, gymId, pqr]
        );
      }

      // QR code for gym entrance
      const token = uuidv4();
      const qrImg = await QRCode.toDataURL(`http://localhost:3000/checkin?token=${token}`, { width: 300 });
      await client.query(
        `INSERT INTO gym_qr_codes (token,qr_image_data,gym_id,location)
         VALUES ($1,$2,$3,'Main Entrance') ON CONFLICT DO NOTHING`,
        [token, qrImg, gymId]
      );

      console.log(`     ✅  10 members + 3 pending + ${PLANS.length} plans + ${checkinCount} check-ins + 1 QR`);
    }

    console.log('\n🎉  Seed complete!\n');
    console.log('Login credentials (ATOM Fitness):');
    console.log('  Admin:  admin@atom-fitness.com / Admin@123');
    console.log('  Staff:  staff@atom-fitness.com / Staff@123');
    console.log('  Member: member1@atom-fitness.com / Member@123\n');
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error('\n❌  Seed failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
