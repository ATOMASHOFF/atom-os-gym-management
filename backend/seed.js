require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query } = require('./config/database');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');

const gyms = [
  { name: 'ATOM Fitness', slug: 'atom-fitness', owner_name: 'Ashish Kumar', owner_email: 'ashish@atomfitness.com', owner_phone: '+91-9876543210', address: 'North Delhi, Delhi' },
  { name: 'PowerHouse Gym', slug: 'powerhouse', owner_name: 'Raj Malhotra', owner_email: 'raj@powerhouse.com', owner_phone: '+91-9876543211', address: 'Andheri West, Mumbai' },
];

async function seed() {
  console.log('🌱 Seeding database...');

  // Create tables
  const fs = require('fs');
  const schema = fs.readFileSync('./config/schema.sql', 'utf8');
  await query(schema);
  console.log('✅ Schema created');

  for (const gym of gyms) {
    // Insert gym
    const gymResult = await query(
      `INSERT INTO gyms (name, slug, owner_name, owner_email, owner_phone, address)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [gym.name, gym.slug, gym.owner_name, gym.owner_email, gym.owner_phone, gym.address]
    );
    const gymId = gymResult.rows[0].id;
    console.log(`✅ Gym: ${gym.name} (ID: ${gymId})`);

    // Admin
    const adminHash = await bcrypt.hash('Admin@123', 12);
    const admin = await query(
      `INSERT INTO members (name, email, phone, password_hash, role, gym_id, status)
       VALUES ($1, $2, $3, $4, 'admin', $5, 'active')
       ON CONFLICT (email, gym_id) DO UPDATE SET password_hash = EXCLUDED.password_hash RETURNING id`,
      [`${gym.owner_name}`, `admin@${gym.slug}.com`, gym.owner_phone, adminHash, gymId]
    );
    console.log(`   👤 Admin: admin@${gym.slug}.com`);

    // Staff
    const staffHash = await bcrypt.hash('Staff@123', 12);
    const staff = await query(
      `INSERT INTO members (name, email, phone, password_hash, role, gym_id, status)
       VALUES ($1, $2, $3, $4, 'staff', $5, 'active')
       ON CONFLICT (email, gym_id) DO UPDATE SET password_hash = EXCLUDED.password_hash RETURNING id`,
      ['Staff Member', `staff@${gym.slug}.com`, '+91-9999999999', staffHash, gymId]
    );
    await query(
      `INSERT INTO staff_permissions (staff_id, gym_id, can_scan_attendance, can_view_members, can_view_attendance)
       VALUES ($1, $2, true, true, true) ON CONFLICT (staff_id, gym_id) DO NOTHING`,
      [staff.rows[0].id, gymId]
    );

    // Plans
    const plans = [
      { name: 'Monthly', duration_days: 30, price: 800, description: 'Standard monthly access' },
      { name: 'Quarterly', duration_days: 90, price: 2100, description: '3 months - save 12%' },
      { name: 'Half Yearly', duration_days: 180, price: 3600, description: '6 months - save 25%' },
      { name: 'Annual', duration_days: 365, price: 6000, description: 'Best value - save 37%' },
    ];
    const planIds = [];
    for (const p of plans) {
      const pr = await query(
        `INSERT INTO membership_plans (gym_id, name, duration_days, price, description)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING RETURNING id`,
        [gymId, p.name, p.duration_days, p.price, p.description]
      );
      if (pr.rows.length) planIds.push({ id: pr.rows[0].id, ...p });
    }

    // 10 Members with subscriptions
    const memberHash = await bcrypt.hash('Member@123', 12);
    for (let i = 1; i <= 10; i++) {
      const m = await query(
        `INSERT INTO members (name, email, phone, password_hash, role, gym_id, status)
         VALUES ($1, $2, $3, $4, 'member', $5, 'active')
         ON CONFLICT (email, gym_id) DO UPDATE SET password_hash = EXCLUDED.password_hash RETURNING id`,
        [`Member ${i}`, `member${i}@${gym.slug}.com`, `+91-98765432${i.toString().padStart(2,'0')}`, memberHash, gymId]
      );
      const memberId = m.rows[0].id;
      
      if (planIds.length > 0) {
        const plan = planIds[i % planIds.length];
        const start = new Date();
        start.setDate(start.getDate() - Math.floor(Math.random() * 60));
        const end = new Date(start);
        end.setDate(end.getDate() + plan.duration_days);
        
        const sub = await query(
          `INSERT INTO subscriptions (member_id, plan_id, gym_id, start_date, end_date, status, payment_method, amount_paid)
           VALUES ($1, $2, $3, $4, $5, $6, 'cash', $7) ON CONFLICT DO NOTHING RETURNING id`,
          [memberId, plan.id, gymId, start.toISOString().split('T')[0], end.toISOString().split('T')[0], end > new Date() ? 'active' : 'expired', plan.price]
        );

        // Attendance logs (last 20 days)
        if (sub.rows.length) {
          for (let d = 1; d <= 15; d++) {
            if (Math.random() > 0.4) {
              const date = new Date();
              date.setDate(date.getDate() - d);
              await query(
                `INSERT INTO attendance_logs (member_id, subscription_id, gym_id, check_in_time, check_in_date, scan_method)
                 VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
                [memberId, sub.rows[0].id, gymId, date, date.toISOString().split('T')[0], Math.random() > 0.5 ? 'qr' : 'manual']
              );
            }
          }
        }
      }
    }

    // Pending members
    for (let i = 1; i <= 3; i++) {
      await query(
        `INSERT INTO members (name, email, phone, password_hash, role, gym_id, status)
         VALUES ($1, $2, $3, $4, 'member', $5, 'pending')
         ON CONFLICT (email, gym_id) DO NOTHING`,
        [`Pending ${i}`, `pending${i}@${gym.slug}.com`, '+91-1111111111', memberHash, gymId]
      );
    }

    // QR Code
    const token = uuidv4();
    const qrData = `http://localhost:3000/checkin?token=${token}`;
    const qrImg = await QRCode.toDataURL(qrData, { width: 300 });
    await query(
      `INSERT INTO gym_qr_codes (token, qr_image_data, gym_id, location)
       VALUES ($1, $2, $3, 'Main Entrance') ON CONFLICT (token) DO NOTHING`,
      [token, qrImg, gymId]
    );
    console.log(`   ✅ Seeded 10 members + plans + attendance + QR for ${gym.name}`);
  }

  console.log('\n🎉 Seed complete!\n');
  console.log('Login credentials:');
  console.log('  Admin: admin@atom-fitness.com / Admin@123');
  console.log('  Staff: staff@atom-fitness.com / Staff@123');
  console.log('  Member: member1@atom-fitness.com / Member@123');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
