'use strict';
const { query, audit } = require('../config/database');
const AppError = require('../utils/AppError');
const { catchAsync } = require('../middleware/errorHandler');

const getPlans = catchAsync(async (req, res) => {
  const gymId = Number(req.gymId);
  const r = await query(`SELECT p.*, COUNT(s.id) FILTER (WHERE s.status='active') as subscriber_count FROM membership_plans p LEFT JOIN subscriptions s ON p.id=s.plan_id WHERE p.gym_id=$1 GROUP BY p.id ORDER BY p.price ASC`, [gymId]);
  res.json({ success: true, data: { plans: r.rows } });
});
const createPlan = catchAsync(async (req, res) => {
  const { name, duration_days, price, description, features } = req.body;
  const r = await query(`INSERT INTO membership_plans (gym_id,name,duration_days,price,description,features) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [req.gymId, name, duration_days, price, description||null, features||[]]);
  res.status(201).json({ success: true, data: r.rows[0] });
});
const updatePlan = catchAsync(async (req, res) => {
  const { name, duration_days, price, description, features, is_active } = req.body;
  const r = await query(`UPDATE membership_plans SET name=COALESCE($1,name), duration_days=COALESCE($2,duration_days), price=COALESCE($3,price), description=COALESCE($4,description), features=COALESCE($5,features), is_active=COALESCE($6,is_active), updated_at=NOW() WHERE id=$7 AND gym_id=$8 RETURNING *`, [name, duration_days, price, description, features, is_active, req.params.id, req.gymId]);
  if (!r.rows.length) throw AppError.notFound('Plan not found');
  res.json({ success: true, data: r.rows[0] });
});
const deletePlan = catchAsync(async (req, res) => {
  const r = await query(`UPDATE membership_plans SET is_active=false, updated_at=NOW() WHERE id=$1 AND gym_id=$2 RETURNING id`, [req.params.id, req.gymId]);
  if (!r.rows.length) throw AppError.notFound('Plan not found');
  res.json({ success: true, message: 'Plan deactivated' });
});
module.exports = { getPlans, createPlan, updatePlan, deletePlan };
