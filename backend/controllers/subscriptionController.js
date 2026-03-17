'use strict';
const { query, withTransaction, audit } = require('../config/database');
const AppError = require('../utils/AppError');
const { catchAsync } = require('../middleware/errorHandler');

const getSubscriptions = catchAsync(async (req, res) => {
  const { status, member_id } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const offset = (page - 1) * limit;
  let conditions = ['s.gym_id = $1'], params = [req.gymId], p = 2;
  if (status)    { conditions.push(`s.status = $${p++}`);    params.push(status); }
  if (member_id) { conditions.push(`s.member_id = $${p++}`); params.push(parseInt(member_id)); }
  const where = conditions.join(' AND ');
  const [count, data] = await Promise.all([
    query(`SELECT COUNT(*) FROM subscriptions s WHERE ${where}`, params),
    query(`SELECT s.*, m.name as member_name, m.email as member_email, m.phone as member_phone,
                  p.name as plan_name, p.duration_days
           FROM subscriptions s
           LEFT JOIN members m ON s.member_id = m.id
           LEFT JOIN membership_plans p ON s.plan_id = p.id
           WHERE ${where} ORDER BY s.created_at DESC LIMIT $${p} OFFSET $${p+1}`,
      [...params, limit, offset]),
  ]);
  res.json({ success: true, data: { subscriptions: data.rows, total: parseInt(count.rows[0].count), page, limit } });
});

const createSubscription = catchAsync(async (req, res) => {
  const { member_id, plan_id, start_date, end_date, payment_method, amount_paid, notes } = req.body;
  if (new Date(end_date) < new Date(start_date)) throw AppError.badRequest('End date must be after start date');

  const sub = await withTransaction(async (client) => {
    const m = await client.query('SELECT id FROM members WHERE id=$1 AND gym_id=$2 AND is_active=true', [member_id, req.gymId]);
    if (!m.rows.length) throw AppError.notFound('Member not found');
    const p = await client.query('SELECT * FROM membership_plans WHERE id=$1 AND gym_id=$2 AND is_active=true', [plan_id, req.gymId]);
    if (!p.rows.length) throw AppError.notFound('Plan not found');
    // Expire overlapping active subs
    await client.query(`UPDATE subscriptions SET status='expired', updated_at=NOW() WHERE member_id=$1 AND gym_id=$2 AND status='active' AND end_date < $3`, [member_id, req.gymId, start_date]);
    const r = await client.query(
      `INSERT INTO subscriptions (member_id,plan_id,gym_id,start_date,end_date,status,payment_method,amount_paid,notes)
       VALUES ($1,$2,$3,$4,$5,'active',$6,$7,$8) RETURNING *`,
      [member_id, plan_id, req.gymId, start_date, end_date, payment_method || null, amount_paid ?? p.rows[0].price, notes || null]
    );
    return r.rows[0];
  });
  await audit(req.gymId, req.user.id, req.user.role, 'CREATE_SUBSCRIPTION', 'subscriptions', sub.id, null, sub, req.ip, req.id);
  res.status(201).json({ success: true, data: sub });
});

const getSubscription = catchAsync(async (req, res) => {
  const r = await query(`SELECT s.*, m.name as member_name, p.name as plan_name FROM subscriptions s LEFT JOIN members m ON s.member_id=m.id LEFT JOIN membership_plans p ON s.plan_id=p.id WHERE s.id=$1 AND s.gym_id=$2`, [req.params.id, req.gymId]);
  if (!r.rows.length) throw AppError.notFound('Subscription not found');
  res.json({ success: true, data: r.rows[0] });
});

const updateSubscription = catchAsync(async (req, res) => {
  const { status, end_date, payment_method, amount_paid, notes } = req.body;
  const r = await query(`UPDATE subscriptions SET status=COALESCE($1,status), end_date=COALESCE($2,end_date), payment_method=COALESCE($3,payment_method), amount_paid=COALESCE($4,amount_paid), notes=COALESCE($5,notes), updated_at=NOW() WHERE id=$6 AND gym_id=$7 RETURNING *`, [status, end_date||null, payment_method, amount_paid, notes, req.params.id, req.gymId]);
  if (!r.rows.length) throw AppError.notFound('Subscription not found');
  res.json({ success: true, data: r.rows[0] });
});

const cancelSubscription = catchAsync(async (req, res) => {
  const r = await query(`UPDATE subscriptions SET status='cancelled', updated_at=NOW() WHERE id=$1 AND gym_id=$2 RETURNING id`, [req.params.id, req.gymId]);
  if (!r.rows.length) throw AppError.notFound('Subscription not found');
  await audit(req.gymId, req.user.id, req.user.role, 'CANCEL_SUBSCRIPTION', 'subscriptions', parseInt(req.params.id), null, { status: 'cancelled' }, req.ip, req.id);
  res.json({ success: true, message: 'Subscription cancelled' });
});

module.exports = { getSubscriptions, createSubscription, getSubscription, updateSubscription, cancelSubscription };
