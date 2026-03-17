'use strict';
const { query, audit } = require('../config/database');
const AppError = require('../utils/AppError');
const { catchAsync } = require('../middleware/errorHandler');

const getCurrentGym = catchAsync(async (req, res) => {
  const r = await query('SELECT * FROM gyms WHERE id=$1', [req.gymId]);
  if (!r.rows.length) throw AppError.notFound('Gym not found');
  res.json({ success: true, data: r.rows[0] });
});
const updateGym = catchAsync(async (req, res) => {
  const { name, owner_name, owner_email, owner_phone, address, logo_url } = req.body;
  const r = await query(`UPDATE gyms SET name=COALESCE($1,name), owner_name=COALESCE($2,owner_name), owner_email=COALESCE($3,owner_email), owner_phone=COALESCE($4,owner_phone), address=COALESCE($5,address), logo_url=COALESCE($6,logo_url), updated_at=NOW() WHERE id=$7 RETURNING *`, [name, owner_name, owner_email, owner_phone, address, logo_url, req.gymId]);
  await audit(req.gymId, req.user.id, req.user.role, 'UPDATE_GYM', 'gyms', req.gymId, null, req.body, req.ip, req.id);
  res.json({ success: true, data: r.rows[0] });
});
const getAllGyms = catchAsync(async (req, res) => {
  const r = await query('SELECT id, name, slug, owner_name, address FROM gyms WHERE is_active=true ORDER BY name');
  res.json({ success: true, data: { gyms: r.rows } });
});
module.exports = { getCurrentGym, updateGym, getAllGyms };
