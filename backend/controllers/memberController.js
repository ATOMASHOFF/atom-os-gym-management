'use strict';
const bcrypt = require('bcryptjs');
const { query, withTransaction, audit } = require('../config/database');
const AppError = require('../utils/AppError');
const { catchAsync } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// FIX [6]: Single JOIN query instead of correlated subqueries per row
const getMembers = catchAsync(async (req, res) => {
  const { role, status, search } = req.query;
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50)); // Cap at 100
  const offset = (page - 1) * limit;

  let conditions = ["m.gym_id = $1", "m.status != 'pending'", "m.is_active = true"];
  const params = [req.gymId];
  let p = 2;

  if (role)   { conditions.push(`m.role = $${p++}`);   params.push(role); }
  if (status) { conditions.push(`m.status = $${p++}`); params.push(status); }
  if (search) {
    conditions.push(`(m.name ILIKE $${p} OR m.email ILIKE $${p} OR m.phone ILIKE $${p})`);
    params.push(`%${search.trim()}%`); p++;
  }

  const where = conditions.join(' AND ');

  // Single query with LEFT JOINs — no N+1
  const [countResult, dataResult] = await Promise.all([
    query(`SELECT COUNT(*) FROM members m WHERE ${where}`, params),
    query(
      `SELECT
         m.id, m.name, m.email, m.phone, m.role, m.status, m.member_type,
         m.date_of_birth, m.created_at, m.last_login_at,
         COALESCE(att.total_checkins, 0) AS total_checkins,
         att.last_checkin,
         active_sub.end_date AS subscription_end,
         active_sub.plan_name
       FROM members m
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS total_checkins, MAX(check_in_date) AS last_checkin
         FROM attendance_logs WHERE member_id = m.id
       ) att ON true
       LEFT JOIN LATERAL (
         SELECT s.end_date, p.name AS plan_name
         FROM subscriptions s
         LEFT JOIN membership_plans p ON s.plan_id = p.id
         WHERE s.member_id = m.id AND s.status = 'active' AND s.end_date >= CURRENT_DATE
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
      total: parseInt(countResult.rows[0].count),
      page, limit,
      pages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
    },
  });
});

const getPendingMembers = catchAsync(async (req, res) => {
  const result = await query(
    `SELECT id, name, email, phone, role, member_type, created_at
     FROM members WHERE gym_id = $1 AND status = 'pending' AND is_active = true
     ORDER BY created_at DESC`,
    [req.gymId]
  );
  res.json({ success: true, data: { members: result.rows } });
});

const getMember = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await query(
    `SELECT m.id, m.name, m.email, m.phone, m.role, m.status, m.member_type,
            m.date_of_birth, m.address, m.emergency_contact, m.notes, m.created_at,
            COALESCE(att.total_checkins, 0) AS total_checkins,
            att.last_checkin
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
       WHERE s.member_id = $1 ORDER BY s.created_at DESC LIMIT 10`,
      [id]
    ),
    query(
      `SELECT check_in_date, check_in_time, scan_method
       FROM attendance_logs WHERE member_id = $1 ORDER BY check_in_time DESC LIMIT 20`,
      [id]
    ),
  ]);
  member.subscriptions = subs.rows;
  member.recent_attendance = attendance.rows;
  res.json({ success: true, data: member });
});

// FIX [7]: use transaction so member + permissions are atomic
const createMember = catchAsync(async (req, res) => {
  const { name, email, phone, password, role = 'member', member_type = 'regular',
          date_of_birth, address, emergency_contact, notes } = req.body;

  const exists = await query(
    'SELECT id FROM members WHERE email = $1 AND gym_id = $2',
    [email.toLowerCase(), req.gymId]
  );
  if (exists.rows.length) throw AppError.conflict('Email already registered at this gym');

  const hash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS || '12'));
  const crypto = require('crypto');
  const qrToken = 'MBR-' + Date.now() + '-' + crypto.randomBytes(8).toString('hex').toUpperCase();

  const member = await withTransaction(async (client) => {
    const r = await client.query(
      `INSERT INTO members
         (name, email, phone, password_hash, role, gym_id, status, member_type,
          date_of_birth, address, emergency_contact, notes, qr_token, member_code)
       VALUES ($1,$2,$3,$4,$5,$6,'active',$7,$8,$9,$10,$11,$12,
         'ATM-' || LPAD(nextval('member_code_seq')::text, 6, '0'))
       RETURNING id, name, email, phone, role, status, member_type, created_at`,
      [name, email.toLowerCase(), phone || null, hash, role, req.gymId,
       member_type, date_of_birth || null, address || null, emergency_contact || null,
       notes || null, qrToken]
    );
    const newMember = r.rows[0];
    if (role === 'staff') {
      await client.query(
        'INSERT INTO staff_permissions (staff_id, gym_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [newMember.id, req.gymId]
      );
    }
    return newMember;
  });

  await audit(req.gymId, req.user.id, req.user.role, 'CREATE_MEMBER', 'members', member.id,
    null, { name, email, role }, req.ip, req.id);
  logger.info('Member created', { memberId: member.id, by: req.user.id, requestId: req.id });

  res.status(201).json({ success: true, data: member });
});

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
       name = COALESCE($1, name), phone = COALESCE($2, phone),
       status = COALESCE($3, status), member_type = COALESCE($4, member_type),
       date_of_birth = COALESCE($5, date_of_birth), address = COALESCE($6, address),
       emergency_contact = COALESCE($7, emergency_contact), notes = COALESCE($8, notes),
       updated_at = NOW()
     WHERE id = $9 AND gym_id = $10
     RETURNING id, name, email, phone, role, status, member_type, date_of_birth, address, updated_at`,
    [name, phone, status, member_type, date_of_birth || null,
     address, emergency_contact, notes, id, req.gymId]
  );

  await audit(req.gymId, req.user.id, req.user.role, 'UPDATE_MEMBER', 'members', parseInt(id),
    existing.rows[0], result.rows[0], req.ip, req.id);

  res.json({ success: true, data: result.rows[0] });
});

const deleteMember = catchAsync(async (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === req.user.id) throw AppError.badRequest('Cannot delete your own account');

  const result = await query(
    `UPDATE members SET is_active = false, status = 'inactive', updated_at = NOW()
     WHERE id = $1 AND gym_id = $2 AND is_active = true RETURNING id, name`,
    [id, req.gymId]
  );
  if (!result.rows.length) throw AppError.notFound('Member not found');

  await audit(req.gymId, req.user.id, req.user.role, 'DELETE_MEMBER', 'members',
    parseInt(id), { id, name: result.rows[0].name }, null, req.ip, req.id);

  res.json({ success: true, message: 'Member removed' });
});

const approveRegistration = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await query(
    `UPDATE members SET status = 'active', updated_at = NOW()
     WHERE id = $1 AND gym_id = $2 AND status = 'pending'
     RETURNING id, name, email`,
    [id, req.gymId]
  );
  if (!result.rows.length) throw AppError.notFound('Pending member not found');
  await audit(req.gymId, req.user.id, req.user.role, 'APPROVE_MEMBER', 'members',
    parseInt(id), null, { status: 'active' }, req.ip, req.id);
  res.json({ success: true, message: 'Member approved', data: result.rows[0] });
});

const rejectRegistration = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await query(
    `UPDATE members SET status = 'inactive', is_active = false, updated_at = NOW()
     WHERE id = $1 AND gym_id = $2 AND status = 'pending' RETURNING id`,
    [id, req.gymId]
  );
  if (!result.rows.length) throw AppError.notFound('Pending member not found');
  await audit(req.gymId, req.user.id, req.user.role, 'REJECT_MEMBER', 'members',
    parseInt(id), null, { status: 'inactive' }, req.ip, req.id);
  res.json({ success: true, message: 'Member rejected' });
});

const getDashboardStats = catchAsync(async (req, res) => {
  const gymId = req.gymId;
  const [members, subs, todayAtt, revenue, expiring] = await Promise.all([
    query(
      `SELECT
         COUNT(*) FILTER (WHERE status != 'pending' AND is_active)   AS total_members,
         COUNT(*) FILTER (WHERE status = 'active' AND is_active)     AS active_members,
         COUNT(*) FILTER (WHERE status = 'pending')                  AS pending_members,
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days' AND status != 'pending') AS new_this_month
       FROM members WHERE gym_id = $1`, [gymId]),
    query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'active')                   AS active_subscriptions,
         COUNT(*) FILTER (WHERE status = 'expired')                  AS expired_subscriptions
       FROM subscriptions WHERE gym_id = $1`, [gymId]),
    query('SELECT COUNT(*) AS today_checkins FROM attendance_logs WHERE gym_id = $1 AND check_in_date = CURRENT_DATE', [gymId]),
    query(
      `SELECT COALESCE(SUM(amount_paid),0) AS total_revenue,
              COALESCE(SUM(amount_paid) FILTER (WHERE created_at >= DATE_TRUNC('month', NOW())),0) AS monthly_revenue
       FROM subscriptions WHERE gym_id = $1 AND status != 'cancelled'`, [gymId]),
    query(
      `SELECT COUNT(*) AS expiring_soon FROM subscriptions
       WHERE gym_id = $1 AND status = 'active' AND end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7`, [gymId]),
  ]);
  res.json({
    success: true,
    data: {
      ...members.rows[0],
      ...subs.rows[0],
      today_checkins: parseInt(todayAtt.rows[0].today_checkins),
      total_revenue:   parseFloat(revenue.rows[0].total_revenue),
      monthly_revenue: parseFloat(revenue.rows[0].monthly_revenue),
      expiring_soon:   parseInt(expiring.rows[0].expiring_soon),
    },
  });
});

module.exports = {
  getMembers, getPendingMembers, getMember, createMember,
  updateMember, deleteMember, approveRegistration, rejectRegistration, getDashboardStats,
};
