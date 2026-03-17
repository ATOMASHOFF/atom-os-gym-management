'use strict';
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query, withTransaction } = require('../config/database');
const AppError = require('../utils/AppError');
const { catchAsync } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// ── Platform stats ────────────────────────────────────────────
const getPlatformStats = catchAsync(async (req, res) => {
  const [gyms, members, subs, checkins, revenue] = await Promise.all([
    query(`SELECT
      COUNT(*)                                                        AS total_gyms,
      COUNT(*) FILTER (WHERE is_active)                              AS active_gyms,
      COUNT(*) FILTER (WHERE NOT is_active)                          AS inactive_gyms,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS new_this_month
      FROM gyms`),
    query(`SELECT
      COUNT(*)                                                        AS total_members,
      COUNT(*) FILTER (WHERE status = 'active' AND is_active)        AS active_members,
      COUNT(*) FILTER (WHERE status = 'pending')                     AS pending_members,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days'
                        AND status != 'pending')                     AS new_this_month
      FROM members`),
    query(`SELECT
      COUNT(*) FILTER (WHERE status = 'active')   AS active_subscriptions,
      COUNT(*) FILTER (WHERE status = 'expired')  AS expired_subscriptions
      FROM subscriptions`),
    query(`SELECT
      COUNT(*)                                                    AS total_checkins,
      COUNT(*) FILTER (WHERE check_in_date = CURRENT_DATE)       AS today_checkins
      FROM attendance_logs`),
    query(`SELECT
      COALESCE(SUM(amount_paid), 0)                               AS total_revenue,
      COALESCE(SUM(amount_paid) FILTER (
        WHERE created_at >= DATE_TRUNC('month', NOW())), 0)       AS monthly_revenue
      FROM subscriptions WHERE status != 'cancelled'`),
  ]);

  res.json({
    success: true,
    data: {
      ...gyms.rows[0],
      ...members.rows[0],
      ...subs.rows[0],
      ...checkins.rows[0],
      total_revenue:   parseFloat(revenue.rows[0].total_revenue   || 0),
      monthly_revenue: parseFloat(revenue.rows[0].monthly_revenue || 0),
    },
  });
});

// ── List all gyms ─────────────────────────────────────────────
const listGyms = catchAsync(async (req, res) => {
  const { search, is_active } = req.query;
  const conditions = ['1=1'];
  const params = [];
  let p = 1;

  if (search) {
    conditions.push(`(g.name ILIKE $${p} OR g.owner_email ILIKE $${p} OR g.slug ILIKE $${p})`);
    params.push(`%${search}%`); p++;
  }
  if (is_active !== undefined && is_active !== '') {
    conditions.push(`g.is_active = $${p++}`);
    params.push(is_active === 'true');
  }

  const where = conditions.join(' AND ');
  const result = await query(
    `SELECT
       g.*,
       COUNT(DISTINCT m.id) FILTER (WHERE m.role = 'member' AND m.status = 'active' AND m.is_active) AS active_members,
       COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'active')                                       AS active_subscriptions,
       COUNT(DISTINCT al.id) FILTER (WHERE al.check_in_date = CURRENT_DATE)                          AS today_checkins,
       (SELECT max_a.email FROM members max_a
        WHERE max_a.gym_id = g.id AND max_a.role = 'admin' AND max_a.is_active = true
        LIMIT 1) AS admin_email
     FROM gyms g
     LEFT JOIN members m ON m.gym_id = g.id
     LEFT JOIN subscriptions s ON s.gym_id = g.id
     LEFT JOIN attendance_logs al ON al.gym_id = g.id
     WHERE ${where}
     GROUP BY g.id
     ORDER BY g.created_at DESC`,
    params
  );
  res.json({ success: true, data: { gyms: result.rows } });
});

// ── Get single gym ────────────────────────────────────────────
const getGym = catchAsync(async (req, res) => {
  const gymId = parseInt(req.params.gymId);

  const [gym, stats, admins, recentCheckins] = await Promise.all([
    query('SELECT * FROM gyms WHERE id = $1', [gymId]),
    query(`SELECT
      COUNT(DISTINCT m.id) FILTER (WHERE m.role='member' AND m.status='active' AND m.is_active)  AS total_members,
      COUNT(DISTINCT m.id) FILTER (WHERE m.status='pending')                                     AS pending_members,
      COUNT(DISTINCT s.id) FILTER (WHERE s.status='active')                                      AS active_subscriptions,
      COALESCE(SUM(s.amount_paid) FILTER (WHERE s.status!='cancelled'), 0)                       AS total_revenue,
      COALESCE(SUM(s.amount_paid) FILTER (
        WHERE s.created_at >= DATE_TRUNC('month', NOW())), 0)                                    AS monthly_revenue,
      COUNT(DISTINCT al.id) FILTER (WHERE al.check_in_date = CURRENT_DATE)                       AS today_checkins,
      COUNT(DISTINCT al.id)                                                                        AS total_checkins
      FROM gyms g
      LEFT JOIN members m  ON m.gym_id  = g.id
      LEFT JOIN subscriptions s ON s.gym_id = g.id
      LEFT JOIN attendance_logs al ON al.gym_id = g.id
      WHERE g.id = $1`, [gymId]),
    query(`SELECT id, name, email, phone, status, last_login_at, created_at
           FROM members WHERE gym_id = $1 AND role = 'admin' AND is_active = true
           ORDER BY created_at`, [gymId]),
    query(`SELECT al.check_in_date, COUNT(*) AS checkin_count
           FROM attendance_logs al WHERE al.gym_id = $1
           GROUP BY al.check_in_date ORDER BY al.check_in_date DESC LIMIT 30`, [gymId]),
  ]);

  if (!gym.rows.length) throw AppError.notFound('Gym not found');

  res.json({
    success: true,
    data: {
      gym: gym.rows[0],
      stats: {
        ...stats.rows[0],
        total_revenue:   parseFloat(stats.rows[0].total_revenue   || 0),
        monthly_revenue: parseFloat(stats.rows[0].monthly_revenue || 0),
      },
      admins: admins.rows,
      recent_checkins: recentCheckins.rows,
    },
  });
});

// ── Create gym + admin (one transaction) ─────────────────────
const createGym = catchAsync(async (req, res) => {
  const {
    gym_name,
    gym_slug,
    gym_address  = '',
    gym_phone    = '',
    gym_plan     = 'starter',
    admin_name,
    admin_email,
    admin_phone  = '',
    admin_password,
  } = req.body;

  // All validations already handled by express-validator in route
  // but double-check slug uniqueness with a clear message
  const slugExists = await query('SELECT id FROM gyms WHERE slug = $1', [gym_slug.trim()]);
  if (slugExists.rows.length) {
    throw AppError.conflict(`Slug "${gym_slug}" is already taken. Try a different name.`);
  }

  const emailLower = admin_email.trim().toLowerCase();

  const hash     = await bcrypt.hash(admin_password, parseInt(process.env.BCRYPT_ROUNDS || '12'));
  const qrToken  = 'MBR-A-' + crypto.randomBytes(8).toString('hex').toUpperCase();

  const result = await withTransaction(async (client) => {
    // 1. Create gym
    const gymR = await client.query(
      `INSERT INTO gyms (name, slug, owner_name, owner_email, owner_phone, address, plan)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [gym_name.trim(), gym_slug.trim(), admin_name.trim(),
       emailLower, gym_phone || null, gym_address || null, gym_plan]
    );
    const gymId = gymR.rows[0].id;

    // 2. Create gym admin
    const adminR = await client.query(
      `INSERT INTO members (name, email, phone, password_hash, role, gym_id, status, qr_token)
       VALUES ($1, $2, $3, $4, 'admin', $5, 'active', $6)
       RETURNING id, name, email, role, gym_id`,
      [admin_name.trim(), emailLower, admin_phone || null, hash, gymId, qrToken]
    );

    return { gym: gymR.rows[0], admin: adminR.rows[0] };
  });

  // Audit log (non-critical — don't let it break the response)
  query(
    `INSERT INTO audit_logs
       (gym_id, actor_id, actor_type, actor_role, action, entity, entity_id, new_data, ip_address, request_id)
     VALUES ($1, $2, 'super_admin', 'super_admin', 'CREATE_GYM', 'gyms', $3, $4, $5, $6)`,
    [result.gym.id, req.user.id, result.gym.id,
     JSON.stringify({ gym_name, admin_email: emailLower }),
     req.ip, req.id]
  ).catch(err => logger.warn('Audit log failed for CREATE_GYM', { error: err.message }));

  logger.info('Gym created by super_admin', {
    gymId: result.gym.id, gymName: gym_name,
    by: req.user.id, requestId: req.id,
  });

  res.status(201).json({
    success: true,
    message: 'Gym created successfully',
    data: {
      gym:           result.gym,
      admin:         result.admin,
      admin_password,    // returned once so super admin can hand credentials to gym owner
    },
  });
});

// ── Update gym ────────────────────────────────────────────────
const updateGym = catchAsync(async (req, res) => {
  const gymId = parseInt(req.params.gymId);
  const { name, owner_name, owner_email, owner_phone, address, plan, is_active } = req.body;

  const r = await query(
    `UPDATE gyms SET
       name        = COALESCE($1, name),
       owner_name  = COALESCE($2, owner_name),
       owner_email = COALESCE($3, owner_email),
       owner_phone = COALESCE($4, owner_phone),
       address     = COALESCE($5, address),
       plan        = COALESCE($6, plan),
       is_active   = COALESCE($7, is_active),
       updated_at  = NOW()
     WHERE id = $8 RETURNING *`,
    [name, owner_name, owner_email?.toLowerCase() || null, owner_phone, address, plan, is_active, gymId]
  );
  if (!r.rows.length) throw AppError.notFound('Gym not found');
  res.json({ success: true, data: r.rows[0] });
});

// ── Toggle gym active/inactive ────────────────────────────────
const toggleGym = catchAsync(async (req, res) => {
  const gymId = parseInt(req.params.gymId);
  const r = await query(
    `UPDATE gyms SET is_active = NOT is_active, updated_at = NOW()
     WHERE id = $1 RETURNING id, name, is_active`,
    [gymId]
  );
  if (!r.rows.length) throw AppError.notFound('Gym not found');
  res.json({ success: true, data: r.rows[0] });
});

// ── View members of any gym ───────────────────────────────────
const getGymMembers = catchAsync(async (req, res) => {
  const gymId = parseInt(req.params.gymId);
  const { role, status, search } = req.query;
  const page   = Math.max(1, parseInt(req.query.page)  || 1);
  const limit  = Math.min(100, parseInt(req.query.limit) || 50);
  const offset = (page - 1) * limit;

  const conditions = ['m.gym_id = $1', 'm.is_active = true'];
  const params = [gymId];
  let p = 2;

  if (role)   { conditions.push(`m.role = $${p++}`);   params.push(role); }
  if (status) { conditions.push(`m.status = $${p++}`); params.push(status); }
  if (search) {
    conditions.push(`(m.name ILIKE $${p} OR m.email ILIKE $${p})`);
    params.push(`%${search}%`); p++;
  }

  const where = conditions.join(' AND ');
  const [count, data] = await Promise.all([
    query(`SELECT COUNT(*) FROM members m WHERE ${where}`, params),
    query(
      `SELECT m.id, m.name, m.email, m.phone, m.role, m.status, m.member_type,
              m.created_at, m.last_login_at,
              COALESCE(att.total, 0) AS total_checkins,
              sub.end_date AS subscription_end, sub.plan_name
       FROM members m
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS total FROM attendance_logs WHERE member_id = m.id
       ) att ON true
       LEFT JOIN LATERAL (
         SELECT s.end_date, p.name AS plan_name
         FROM subscriptions s LEFT JOIN membership_plans p ON s.plan_id = p.id
         WHERE s.member_id = m.id AND s.status = 'active'
         ORDER BY s.end_date DESC LIMIT 1
       ) sub ON true
       WHERE ${where}
       ORDER BY m.created_at DESC
       LIMIT $${p} OFFSET $${p+1}`,
      [...params, limit, offset]
    ),
  ]);

  res.json({
    success: true,
    data: { members: data.rows, total: parseInt(count.rows[0].count), gym_id: gymId },
  });
});

// ── Reset gym admin password ──────────────────────────────────
const resetAdminPassword = catchAsync(async (req, res) => {
  const gymId   = parseInt(req.params.gymId);
  const adminId = parseInt(req.params.adminId || req.body.admin_id);
  const { new_password } = req.body;
  if (!new_password || new_password.length < 8) throw AppError.badRequest('Password must be at least 8 characters');

  const admin = await query(
    'SELECT id FROM members WHERE id = $1 AND gym_id = $2 AND role = $3',
    [adminId, gymId, 'admin']
  );
  if (!admin.rows.length) throw AppError.notFound('Gym admin not found in this gym');

  const hash = await bcrypt.hash(new_password, parseInt(process.env.BCRYPT_ROUNDS || '12'));
  await query('UPDATE members SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, adminId]);

  res.json({ success: true, message: 'Admin password reset successfully' });
});

// ── Add admin to existing gym ─────────────────────────────────
const createGymAdmin = catchAsync(async (req, res) => {
  const gymId = parseInt(req.params.gymId);
  const { name, email, phone, password } = req.body;
  if (!name || !email || !password) throw AppError.badRequest('name, email, password required');

  const gym = await query('SELECT id FROM gyms WHERE id = $1', [gymId]);
  if (!gym.rows.length) throw AppError.notFound('Gym not found');

  const exists = await query(
    'SELECT id FROM members WHERE email = $1 AND gym_id = $2',
    [email.toLowerCase(), gymId]
  );
  if (exists.rows.length) throw AppError.conflict('Email already registered at this gym');

  const hash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS || '12'));
  const qr   = 'MBR-A-' + crypto.randomBytes(8).toString('hex').toUpperCase();

  const r = await query(
    `INSERT INTO members (name, email, phone, password_hash, role, gym_id, status, qr_token)
     VALUES ($1, $2, $3, $4, 'admin', $5, 'active', $6)
     RETURNING id, name, email, role`,
    [name.trim(), email.toLowerCase(), phone || null, hash, gymId, qr]
  );

  res.status(201).json({ success: true, data: r.rows[0] });
});

// ── Audit log ─────────────────────────────────────────────────
const getGymAuditLog = catchAsync(async (req, res) => {
  const gymId = parseInt(req.params.gymId);
  const r = await query(
    `SELECT al.*,
       COALESCE(m.name, sa.name, 'System') AS actor_name
     FROM audit_logs al
     LEFT JOIN members m ON al.actor_id = m.id AND al.actor_type = 'member'
     LEFT JOIN super_admins sa ON al.actor_id = sa.id AND al.actor_type = 'super_admin'
     WHERE al.gym_id = $1
     ORDER BY al.created_at DESC LIMIT 100`,
    [gymId]
  );
  res.json({ success: true, data: { logs: r.rows } });
});

module.exports = {
  getPlatformStats, listGyms, getGym,
  createGym, updateGym, toggleGym,
  getGymMembers, resetAdminPassword, createGymAdmin,
  getGymAuditLog,
};
