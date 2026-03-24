'use strict';
const bcrypt = require('bcryptjs');
const { query, withTransaction, audit } = require('../config/database');
const AppError = require('../utils/AppError');
const { catchAsync } = require('../middleware/errorHandler');

const getStaff = catchAsync(async (req, res) => {
  const gymId = Number(req.gymId);
  const r = await query(`SELECT m.id, m.name, m.email, m.phone, m.status, m.created_at,
    sp.can_scan_attendance, sp.can_view_members, sp.can_add_members, sp.can_edit_members,
    sp.can_delete_members, sp.can_view_subscriptions, sp.can_add_subscriptions,
    sp.can_view_attendance, sp.can_view_reports, sp.can_view_financial
    FROM members m LEFT JOIN staff_permissions sp ON m.id=sp.staff_id AND m.gym_id=sp.gym_id
    WHERE m.gym_id=$1 AND m.role='staff' AND m.is_active=true ORDER BY m.created_at DESC`, [gymId]);
  res.json({ success: true, data: { staff: r.rows } });
});

const createStaff = catchAsync(async (req, res) => {
  const { name, email, phone, password, permissions = {} } = req.body;
  const exists = await query('SELECT id FROM members WHERE email=$1 AND gym_id=$2', [email.toLowerCase(), req.gymId]);
  if (exists.rows.length) throw AppError.conflict('Email already registered at this gym');
  const hash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS || '12'));
  const crypto = require('crypto');
  const qrToken = 'MBR-' + Date.now() + '-' + crypto.randomBytes(8).toString('hex').toUpperCase();
  const member = await withTransaction(async (client) => {
    const m = await client.query(`INSERT INTO members (name,email,phone,password_hash,role,gym_id,status,qr_token) VALUES ($1,$2,$3,$4,'staff',$5,'active',$6) RETURNING id,name,email,role`, [name, email.toLowerCase(), phone||null, hash, req.gymId, qrToken]);
    const sid = m.rows[0].id;
    await client.query(`INSERT INTO staff_permissions (staff_id,gym_id,can_scan_attendance,can_view_members,can_add_members,can_edit_members,can_delete_members,can_view_subscriptions,can_add_subscriptions,can_view_attendance,can_view_reports,can_view_financial) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, [sid, req.gymId, !!permissions.can_scan_attendance, !!permissions.can_view_members, !!permissions.can_add_members, !!permissions.can_edit_members, !!permissions.can_delete_members, !!permissions.can_view_subscriptions, !!permissions.can_add_subscriptions, !!permissions.can_view_attendance, !!permissions.can_view_reports, !!permissions.can_view_financial]);
    return m.rows[0];
  });
  await audit(req.gymId, req.user.id, req.user.role, 'CREATE_STAFF', 'members', member.id, null, { name, email }, req.ip, req.id);
  res.status(201).json({ success: true, data: { ...member, permissions } });
});

const updateStaffPermissions = catchAsync(async (req, res) => {
  const { id } = req.params;
  const p = req.body;
  const staff = await query('SELECT id FROM members WHERE id=$1 AND gym_id=$2 AND role=$3', [id, req.gymId, 'staff']);
  if (!staff.rows.length) throw AppError.notFound('Staff member not found');
  const r = await query(`INSERT INTO staff_permissions (staff_id,gym_id,can_scan_attendance,can_view_members,can_add_members,can_edit_members,can_delete_members,can_view_subscriptions,can_add_subscriptions,can_view_attendance,can_view_reports,can_view_financial) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (staff_id,gym_id) DO UPDATE SET can_scan_attendance=$3,can_view_members=$4,can_add_members=$5,can_edit_members=$6,can_delete_members=$7,can_view_subscriptions=$8,can_add_subscriptions=$9,can_view_attendance=$10,can_view_reports=$11,can_view_financial=$12,updated_at=NOW() RETURNING *`, [id, req.gymId, !!p.can_scan_attendance, !!p.can_view_members, !!p.can_add_members, !!p.can_edit_members, !!p.can_delete_members, !!p.can_view_subscriptions, !!p.can_add_subscriptions, !!p.can_view_attendance, !!p.can_view_reports, !!p.can_view_financial]);
  await audit(req.gymId, req.user.id, req.user.role, 'UPDATE_STAFF_PERMISSIONS', 'staff_permissions', parseInt(id), null, p, req.ip, req.id);
  res.json({ success: true, data: r.rows[0] });
});

const deleteStaff = catchAsync(async (req, res) => {
  const r = await query(`UPDATE members SET is_active=false, status='inactive', updated_at=NOW() WHERE id=$1 AND gym_id=$2 AND role='staff' RETURNING id`, [req.params.id, req.gymId]);
  if (!r.rows.length) throw AppError.notFound('Staff not found');
  res.json({ success: true, message: 'Staff removed' });
});

module.exports = { getStaff, createStaff, updateStaffPermissions, deleteStaff };
