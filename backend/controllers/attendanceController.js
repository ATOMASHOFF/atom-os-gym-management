'use strict';
const { query, audit } = require('../config/database');
const AppError = require('../utils/AppError');
const { catchAsync } = require('../middleware/errorHandler');

const getAttendance = catchAsync(async (req, res) => {
  const { member_id, date_from, date_to } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 100));
  const offset = (page - 1) * limit;
  let conditions = ['al.gym_id = $1'], params = [req.gymId], p = 2;
  if (member_id) { conditions.push(`al.member_id = $${p++}`); params.push(parseInt(member_id)); }
  if (date_from) { conditions.push(`al.check_in_date >= $${p++}`); params.push(date_from); }
  if (date_to)   { conditions.push(`al.check_in_date <= $${p++}`); params.push(date_to); }
  const where = conditions.join(' AND ');
  const [count, data] = await Promise.all([
    query(`SELECT COUNT(*) FROM attendance_logs al WHERE ${where}`, params),
    query(`SELECT al.*, m.name as member_name, m.email as member_email, p.name as plan_name
           FROM attendance_logs al LEFT JOIN members m ON al.member_id=m.id
           LEFT JOIN subscriptions s ON al.subscription_id=s.id LEFT JOIN membership_plans p ON s.plan_id=p.id
           WHERE ${where} ORDER BY al.check_in_time DESC LIMIT $${p} OFFSET $${p+1}`, [...params, limit, offset]),
  ]);
  res.json({ success: true, data: { attendance: data.rows, total: parseInt(count.rows[0].count), page, limit } });
});

const getTodayAttendance = catchAsync(async (req, res) => {
  const r = await query(`SELECT al.*, m.name as member_name, m.email as member_email, p.name as plan_name
     FROM attendance_logs al LEFT JOIN members m ON al.member_id=m.id
     LEFT JOIN subscriptions s ON al.subscription_id=s.id LEFT JOIN membership_plans p ON s.plan_id=p.id
     WHERE al.gym_id=$1 AND al.check_in_date=CURRENT_DATE ORDER BY al.check_in_time DESC`, [req.gymId]);
  res.json({ success: true, data: { attendance: r.rows } });
});

const manualCheckIn = catchAsync(async (req, res) => {
  const { member_id, notes } = req.body;
  const member = await query('SELECT id, name FROM members WHERE id=$1 AND gym_id=$2 AND status=$3 AND is_active=true', [member_id, req.gymId, 'active']);
  if (!member.rows.length) throw AppError.notFound('Active member not found');
  const sub = await query(`SELECT id FROM subscriptions WHERE member_id=$1 AND gym_id=$2 AND status='active' AND end_date>=CURRENT_DATE ORDER BY end_date DESC LIMIT 1`, [member_id, req.gymId]);
  const r = await query(`INSERT INTO attendance_logs (member_id, subscription_id, gym_id, check_in_time, check_in_date, scan_method, notes) VALUES ($1,$2,$3,NOW(),CURRENT_DATE,'manual',$4) RETURNING *`, [member_id, sub.rows[0]?.id||null, req.gymId, notes||null]);
  res.status(201).json({ success: true, message: 'Checked in', data: { attendance: r.rows[0], member: member.rows[0] } });
});

const qrCheckIn = catchAsync(async (req, res) => {
  const { qr_token } = req.body;
  const qr = await query('SELECT * FROM gym_qr_codes WHERE token=$1 AND is_active=true', [qr_token]);
  if (!qr.rows.length) throw AppError.notFound('Invalid QR code');
  const gymId = qr.rows[0].gym_id;
  const memberId = req.user.id;
  const member = await query('SELECT id, name FROM members WHERE id=$1 AND gym_id=$2 AND status=$3', [memberId, gymId, 'active']);
  if (!member.rows.length) throw AppError.forbidden('Not a member of this gym');
  const sub = await query(`SELECT id FROM subscriptions WHERE member_id=$1 AND gym_id=$2 AND status='active' AND end_date>=CURRENT_DATE LIMIT 1`, [memberId, gymId]);
  await query('UPDATE gym_qr_codes SET scan_count=scan_count+1 WHERE id=$1', [qr.rows[0].id]);
  const r = await query(`INSERT INTO attendance_logs (member_id,subscription_id,gym_qr_id,gym_id,check_in_time,check_in_date,scan_method) VALUES ($1,$2,$3,$4,NOW(),CURRENT_DATE,'qr') RETURNING *`, [memberId, sub.rows[0]?.id||null, qr.rows[0].id, gymId]);
  const info = await query(`SELECT m.name, s.end_date, p.name as plan_name FROM members m LEFT JOIN subscriptions s ON s.member_id=m.id AND s.status='active' AND s.end_date>=CURRENT_DATE LEFT JOIN membership_plans p ON s.plan_id=p.id WHERE m.id=$1 LIMIT 1`, [memberId]);
  res.status(201).json({ success: true, message: 'Checked in!', data: { attendance: r.rows[0], member: info.rows[0] } });
});

const getMemberAttendance = catchAsync(async (req, res) => {
  const r = await query(`SELECT al.*, m.name as member_name FROM attendance_logs al LEFT JOIN members m ON al.member_id=m.id WHERE al.member_id=$1 AND al.gym_id=$2 ORDER BY al.check_in_time DESC LIMIT 90`, [req.params.id, req.gymId]);
  res.json({ success: true, data: { attendance: r.rows } });
});

module.exports = { getAttendance, getTodayAttendance, manualCheckIn, qrCheckIn, getMemberAttendance };
