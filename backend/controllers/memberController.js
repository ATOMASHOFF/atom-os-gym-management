'use strict';
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query, withTransaction, audit } = require('../config/database');
const AppError = require('../utils/AppError');
const { catchAsync } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// ── Helper: generate member code safely (fallback if sequence missing) ────────
async function generateMemberCode(client) {
  try {
    const r = await client.query("SELECT nextval('member_code_seq') AS n");
    return 'ATM-' + String(r.rows[0].n).padStart(6, '0');
  } catch {
    // Fallback: use timestamp-based code if sequence doesn't exist yet
    const r = await client.query('SELECT COALESCE(MAX(id),0)+1 AS n FROM members');
    return 'ATM-' + String(r.rows[0].n).padStart(6, '0');
  }
}

const getMembers = catchAsync(async (req, res) => {
  console.log('[DEBUG] getMembers called. gymId:', req.gymId);
  const gymId = Number(req.gymId);
  if (!gymId) throw AppError.badRequest('gym_id required — super admin must pass X-Gym-ID header');

  const { role, status, search } = req.query;
  const page   = Math.max(1, parseInt(req.query.page)  || 1);
  const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const offset = (page - 1) * limit;

  let conditions = ["m.gym_id = $1", "m.status != 'pending'", "m.is_active = true"];
  const params = [gymId];
  let p = 2;

  if (role)   { conditions.push(`m.role = $${p++}`);   params.push(role); }
  if (status) { conditions.push(`m.status = $${p++}`); params.push(status); }
  if (search) {
    conditions.push(`(m.name ILIKE $${p} OR m.email ILIKE $${p} OR m.phone ILIKE $${p})`);
    params.push(`%${search.trim()}%`); p++;
  }

  const where = conditions.join(' AND ');
  console.log('[DEBUG] getMembers query. where:', where, 'params:', params);

  const [countResult, dataResult] = await Promise.all([
    query(`SELECT COUNT(*) FROM members m WHERE ${where}`, params),
    query(
      `SELECT
         m.id, m.name, m.email, m.phone, m.role, m.status, m.member_type,
         m.member_code, m.date_of_birth, m.created_at, m.last_login_at,
         COALESCE(att.total_checkins, 0) AS total_checkins,
         att.last_checkin,
         active_sub.end_date   AS subscription_end,
         active_sub.plan_name  AS plan_name
       FROM members m
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS total_checkins, MAX(check_in_date) AS last_checkin
         FROM attendance_logs WHERE member_id = m.id AND gym_id = m.gym_id
       ) att ON true
       LEFT JOIN LATERAL (
         SELECT s.end_date, p.name AS plan_name
         FROM subscriptions s
         LEFT JOIN membership_plans p ON s.plan_id = p.id
         WHERE s.member_id = m.id AND s.gym_id = $1
           AND s.status = 'active' AND s.end_date >= CURRENT_DATE
         ORDER BY s.end_date DESC LIMIT 1
       ) active_sub ON true
       WHERE ${where}
       ORDER BY m.created_at DESC
       LIMIT $${p} OFFSET $${p + 1}`,
      [...params, limit, offset]
    ),
  ]);

  res.json({
    success: true,
    data: {
      members: dataResult.rows,
      total:   parseInt(countResult.rows[0].count),
      page, limit,
    },
  });
});

// ── GET /api/members/pending ──────────────────────────────────────────────────
const getPendingMembers = catchAsync(async (req, res) => {
  const result = await query(
    `SELECT id, name, email, phone, role, status, member_type, created_at
     FROM members WHERE gym_id = $1 AND status = 'pending' AND is_active = true
     ORDER BY created_at DESC`,
    [req.gymId]
  );
  res.json({ success: true, data: { members: result.rows } });
});

// ── GET /api/members/me — self-access for any authenticated user ─────────────
const getMyProfile = catchAsync(async (req, res) => {
  const id = req.user.id;
  const gymId = req.gymId;

  const result = await query(
    `SELECT m.id, m.name, m.email, m.phone, m.role, m.status, m.member_type,
            m.member_code, m.date_of_birth, m.address, m.emergency_contact, m.notes,
            m.created_at, m.qr_token,
            COALESCE(att.total_checkins, 0) AS total_checkins, att.last_checkin
     FROM members m
     LEFT JOIN LATERAL (
       SELECT COUNT(*) AS total_checkins, MAX(check_in_date) AS last_checkin
       FROM attendance_logs WHERE member_id = m.id
     ) att ON true
     WHERE m.id = $1 AND m.gym_id = $2 AND m.is_active = true`,
    [id, gymId]
  );
  if (!result.rows.length) throw AppError.notFound('Profile not found');

  const member = result.rows[0];
  const [subs, attendance] = await Promise.all([
    query(
      `SELECT s.*, p.name as plan_name, p.duration_days
       FROM subscriptions s LEFT JOIN membership_plans p ON s.plan_id = p.id
       WHERE s.member_id = $1 AND s.gym_id = $2 ORDER BY s.created_at DESC LIMIT 10`,
      [id, gymId]
    ),
    query(
      `SELECT check_in_date, check_in_time, scan_method
       FROM attendance_logs WHERE member_id = $1 AND gym_id = $2
       ORDER BY check_in_time DESC LIMIT 30`,
      [id, gymId]
    ),
  ]);

  res.json({
    success: true,
    data: { ...member, subscriptions: subs.rows, attendance: attendance.rows },
  });
});

// ── GET /api/members/:id ──────────────────────────────────────────────────────
const getMember = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await query(
    `SELECT m.id, m.name, m.email, m.phone, m.role, m.status, m.member_type,
            m.member_code, m.date_of_birth, m.address, m.emergency_contact, m.notes,
            m.created_at, m.qr_token,
            COALESCE(att.total_checkins, 0) AS total_checkins, att.last_checkin
     FROM members m
     LEFT JOIN LATERAL (
       SELECT COUNT(*) AS total_checkins, MAX(check_in_date) AS last_checkin
       FROM attendance_logs WHERE member_id = m.id
     ) att ON true
     WHERE m.id = $1 AND m.gym_id = $2 AND m.is_active = true`,
    [id, req.gymId]
  );
  if (!result.rows.length) throw AppError.notFound('Member not found');

  const member = result.rows[0];
  const [subs, attendance] = await Promise.all([
    query(
      `SELECT s.*, p.name as plan_name, p.duration_days
       FROM subscriptions s LEFT JOIN membership_plans p ON s.plan_id = p.id
       WHERE s.member_id = $1 AND s.gym_id = $2 ORDER BY s.created_at DESC LIMIT 10`,
      [id, req.gymId]
    ),
    query(
      `SELECT check_in_date, check_in_time, scan_method
       FROM attendance_logs WHERE member_id = $1 AND gym_id = $2
       ORDER BY check_in_time DESC LIMIT 30`,
      [id, req.gymId]
    ),
  ]);

  res.json({
    success: true,
    data: { ...member, subscriptions: subs.rows, attendance: attendance.rows },
  });
});

// ── POST /api/members ─────────────────────────────────────────────────────────
const createMember = catchAsync(async (req, res) => {
  const {
    name, email, phone, password, role = 'member',
    member_type = 'regular', date_of_birth, address,
    emergency_contact, notes,
  } = req.body;

  const exists = await query(
    'SELECT id, name, status, is_active FROM members WHERE email = $1 AND gym_id = $2',
    [email.toLowerCase(), req.gymId]
  );
  if (exists.rows.length) {
    const m = exists.rows[0];
    if (!m.is_active) {
      throw AppError.conflict(
        `This email belongs to a removed member (${m.name}). ` +
        `Restore them from the database or use a different email.`
      );
    }
    if (m.status === 'pending') {
      throw AppError.conflict(
        `This email already has a pending registration awaiting approval.`
      );
    }
    throw AppError.conflict(
      `Email already registered in this gym. Use a different email address.`
    );
  }

  const hash     = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS || '12'));
  const qrToken  = 'MBR-' + crypto.randomBytes(16).toString('hex').toUpperCase();

  const member = await withTransaction(async (client) => {
    const memberCode = await generateMemberCode(client);

    const r = await client.query(
      `INSERT INTO members
         (name, email, phone, password_hash, role, gym_id, status,
          member_type, date_of_birth, address, emergency_contact, notes,
          qr_token, member_code)
       VALUES ($1,$2,$3,$4,$5,$6,'active',$7,$8,$9,$10,$11,$12,$13)
       RETURNING id, name, email, phone, role, status, member_type, member_code, created_at`,
      [name, email.toLowerCase(), phone || null, hash, role, req.gymId,
       member_type, date_of_birth || null, address || null,
       emergency_contact || null, notes || null, qrToken, memberCode]
    );

    if (role === 'staff') {
      await client.query(
        'INSERT INTO staff_permissions (staff_id, gym_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [r.rows[0].id, req.gymId]
      );
    }
    return r.rows[0];
  });

  await audit(req.gymId, req.user.id, req.user.role, 'CREATE_MEMBER', 'members',
    member.id, null, { name, email, role }, req.ip, req.id).catch(() => {});

  logger.info('Member created', { memberId: member.id, by: req.user.id });
  res.status(201).json({ success: true, data: member });
});

// ── PUT /api/members/:id ──────────────────────────────────────────────────────
const updateMember = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { name, phone, status, member_type, date_of_birth, address, emergency_contact, notes } = req.body;

  const existing = await query(
    'SELECT * FROM members WHERE id = $1 AND gym_id = $2 AND is_active = true',
    [id, req.gymId]
  );
  if (!existing.rows.length) throw AppError.notFound('Member not found');

  const result = await query(
    `UPDATE members SET
       name              = COALESCE($1, name),
       phone             = COALESCE($2, phone),
       status            = COALESCE($3, status),
       member_type       = COALESCE($4, member_type),
       date_of_birth     = COALESCE($5, date_of_birth),
       address           = COALESCE($6, address),
       emergency_contact = COALESCE($7, emergency_contact),
       notes             = COALESCE($8, notes),
       updated_at        = NOW()
     WHERE id = $9 AND gym_id = $10
     RETURNING id, name, email, phone, role, status, member_type, member_code, updated_at`,
    [name, phone, status, member_type, date_of_birth || null,
     address, emergency_contact, notes, id, req.gymId]
  );

  await audit(req.gymId, req.user.id, req.user.role, 'UPDATE_MEMBER', 'members',
    parseInt(id), existing.rows[0], result.rows[0], req.ip, req.id).catch(() => {});

  res.json({ success: true, data: result.rows[0] });
});

// ── DELETE /api/members/:id ───────────────────────────────────────────────────
const deleteMember = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await query(
    `UPDATE members SET is_active = false, status = 'inactive', updated_at = NOW()
     WHERE id = $1 AND gym_id = $2 AND is_active = true RETURNING id, name`,
    [id, req.gymId]
  );
  if (!result.rows.length) throw AppError.notFound('Member not found');
  await audit(req.gymId, req.user.id, req.user.role, 'DELETE_MEMBER', 'members',
    parseInt(id), { id, name: result.rows[0].name }, null, req.ip, req.id).catch(() => {});
  res.json({ success: true, message: 'Member removed' });
});

// ── POST /api/members/:id/approve ─────────────────────────────────────────────
const approveRegistration = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await query(
    `UPDATE members SET status = 'active', updated_at = NOW()
     WHERE id = $1 AND gym_id = $2 AND status = 'pending' RETURNING id, name, email`,
    [id, req.gymId]
  );
  if (!result.rows.length) throw AppError.notFound('Pending member not found');
  res.json({ success: true, message: 'Member approved', data: result.rows[0] });
});

// ── POST /api/members/:id/reject ──────────────────────────────────────────────
const rejectRegistration = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await query(
    `UPDATE members SET status = 'inactive', is_active = false, updated_at = NOW()
     WHERE id = $1 AND gym_id = $2 AND status = 'pending' RETURNING id`,
    [id, req.gymId]
  );
  if (!result.rows.length) throw AppError.notFound('Pending member not found');
  res.json({ success: true, message: 'Member rejected' });
});

// ── GET /api/members/dashboard-stats ─────────────────────────────────────────
const getDashboardStats = catchAsync(async (req, res) => {
  const gymId = req.gymId;
  const [members, subs, todayAtt, revenue, expiring] = await Promise.all([
    query(
      `SELECT
         COUNT(*) AS total_members,
         COUNT(*) FILTER (WHERE status = 'active')  AS active_members,
         COUNT(*) FILTER (WHERE status = 'pending') AS pending_members
       FROM members WHERE gym_id = $1 AND is_active = true`, [gymId]),
    query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'active')  AS active_subscriptions,
         COUNT(*) FILTER (WHERE status = 'expired') AS expired_subscriptions
       FROM subscriptions WHERE gym_id = $1`, [gymId]),
    query(
      `SELECT COUNT(*) AS today_checkins
       FROM attendance_logs WHERE gym_id = $1 AND check_in_date = CURRENT_DATE`, [gymId]),
    query(
      `SELECT
         COALESCE(SUM(amount_paid), 0) AS total_revenue,
         COALESCE(SUM(amount_paid) FILTER (
           WHERE created_at >= DATE_TRUNC('month', NOW())), 0) AS monthly_revenue
       FROM subscriptions WHERE gym_id = $1 AND status != 'cancelled'`, [gymId]),
    query(
      `SELECT COUNT(*) AS expiring_soon FROM subscriptions
       WHERE gym_id = $1 AND status = 'active'
         AND end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7`, [gymId]),
  ]);

  res.json({
    success: true,
    data: {
      ...members.rows[0],
      ...subs.rows[0],
      today_checkins:  parseInt(todayAtt.rows[0].today_checkins),
      total_revenue:   parseFloat(revenue.rows[0].total_revenue),
      monthly_revenue: parseFloat(revenue.rows[0].monthly_revenue),
      expiring_soon:   parseInt(expiring.rows[0].expiring_soon),
    },
  });
});

module.exports = {
  getMembers, getPendingMembers, getMyProfile, getMember, createMember,
  updateMember, deleteMember, approveRegistration,
  rejectRegistration, getDashboardStats,
};
