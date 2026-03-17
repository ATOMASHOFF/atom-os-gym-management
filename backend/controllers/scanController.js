'use strict';
const QRCode = require('qrcode');
const crypto = require('crypto');
const { query, audit } = require('../config/database');
const AppError = require('../utils/AppError');
const { catchAsync } = require('../middleware/errorHandler');

const getMemberQR = catchAsync(async (req, res) => {
  const memberId = req.params.id === 'me' ? req.user.id : parseInt(req.params.id);
  if (req.user.role === 'member' && memberId !== req.user.id) throw AppError.forbidden('Access denied');

  const m = await query('SELECT id, name, email, qr_token FROM members WHERE id=$1 AND gym_id=$2 AND is_active=true', [memberId, req.gymId]);
  if (!m.rows.length) throw AppError.notFound('Member not found');
  let { qr_token } = m.rows[0];

  if (!qr_token) {
    qr_token = 'MBR-' + memberId + '-' + crypto.randomBytes(8).toString('hex').toUpperCase();
    await query('UPDATE members SET qr_token=$1 WHERE id=$2', [qr_token, memberId]);
  }

  const qrImageData = await QRCode.toDataURL(qr_token, { width: 320, margin: 2, errorCorrectionLevel: 'M' });
  res.json({ success: true, data: { qr_token, qr_image_data: qrImageData, member: m.rows[0] } });
});

const scanMemberQR = catchAsync(async (req, res) => {
  const { qr_token, action = 'view' } = req.body;

  const mResult = await query(`SELECT m.id, m.name, m.email, m.phone, m.status, m.member_type, m.role, m.date_of_birth, m.created_at, m.gym_id FROM members m WHERE m.qr_token=$1 AND m.is_active=true`, [qr_token]);
  if (!mResult.rows.length) throw AppError.notFound('Invalid QR code — member not found');

  const member = mResult.rows[0];
  if (member.gym_id !== req.gymId) throw AppError.forbidden('This member does not belong to your gym');
  if (member.status === 'pending')   throw AppError.badRequest('Member account pending approval');
  if (member.status === 'suspended') throw AppError.badRequest('Member account suspended');

  const [subResult, attResult, countResult, todayResult] = await Promise.all([
    query(`SELECT s.*, p.name as plan_name, p.duration_days FROM subscriptions s LEFT JOIN membership_plans p ON s.plan_id=p.id WHERE s.member_id=$1 AND s.status='active' ORDER BY s.end_date DESC LIMIT 1`, [member.id]),
    query('SELECT check_in_date, check_in_time, scan_method FROM attendance_logs WHERE member_id=$1 ORDER BY check_in_time DESC LIMIT 10', [member.id]),
    query('SELECT COUNT(*) as total FROM attendance_logs WHERE member_id=$1', [member.id]),
    query('SELECT id FROM attendance_logs WHERE member_id=$1 AND gym_id=$2 AND check_in_date=CURRENT_DATE', [member.id, req.gymId]),
  ]);

  const alreadyCheckedIn = todayResult.rows.length > 0;
  let checkinResult = null;

  if (action === 'checkin') {
    if (alreadyCheckedIn) {
      checkinResult = { success: false, message: 'Already checked in today' };
    } else {
      const sub = subResult.rows[0];
      await query(`INSERT INTO attendance_logs (member_id,subscription_id,gym_id,check_in_time,check_in_date,scan_method) VALUES ($1,$2,$3,NOW(),CURRENT_DATE,'qr')`, [member.id, sub?.id||null, req.gymId]);
      await audit(req.gymId, req.user.id, req.user.role, 'SCAN_CHECKIN', 'attendance_logs', member.id, null, { member_id: member.id }, req.ip, req.id);
      checkinResult = { success: true, message: 'Checked in successfully' };
    }
  }

  const daysLeft = subResult.rows[0] ? Math.ceil((new Date(subResult.rows[0].end_date) - new Date()) / 86400000) : null;

  res.json({
    success: true,
    data: {
      member,
      active_subscription: subResult.rows[0] || null,
      days_left: daysLeft,
      already_checked_in: action === 'checkin' ? (alreadyCheckedIn && !checkinResult?.success) : alreadyCheckedIn,
      total_checkins: parseInt(countResult.rows[0].total),
      recent_attendance: attResult.rows,
      checkin_result: checkinResult,
    },
  });
});

const scanGymQR = catchAsync(async (req, res) => {
  const { qr_token } = req.body;
  const qr = await query('SELECT * FROM gym_qr_codes WHERE token=$1 AND is_active=true', [qr_token]);
  if (!qr.rows.length) throw AppError.notFound('Invalid or inactive QR code');

  const gymId = qr.rows[0].gym_id;
  const memberId = req.user.id;
  const member = await query('SELECT id, name FROM members WHERE id=$1 AND gym_id=$2 AND status=$3', [memberId, gymId, 'active']);
  if (!member.rows.length) throw AppError.forbidden('You are not an active member of this gym');
  const sub = await query(`SELECT id FROM subscriptions WHERE member_id=$1 AND gym_id=$2 AND status='active' AND end_date>=CURRENT_DATE LIMIT 1`, [memberId, gymId]);
  await query('UPDATE gym_qr_codes SET scan_count=scan_count+1 WHERE id=$1', [qr.rows[0].id]);
  const r = await query(`INSERT INTO attendance_logs (member_id,subscription_id,gym_qr_id,gym_id,check_in_time,check_in_date,scan_method) VALUES ($1,$2,$3,$4,NOW(),CURRENT_DATE,'qr') RETURNING *`, [memberId, sub.rows[0]?.id||null, qr.rows[0].id, gymId]);
  const info = await query(`SELECT m.name, s.end_date, p.name as plan_name FROM members m LEFT JOIN subscriptions s ON s.member_id=m.id AND s.status='active' AND s.end_date>=CURRENT_DATE LEFT JOIN membership_plans p ON s.plan_id=p.id WHERE m.id=$1 LIMIT 1`, [memberId]);
  res.status(201).json({ success: true, message: 'Check-in successful!', data: { attendance: r.rows[0], member: info.rows[0] } });
});

module.exports = { getMemberQR, scanMemberQR, scanGymQR };
