'use strict';
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const AppError = require('../utils/AppError');
const { catchAsync } = require('../middleware/errorHandler');
const crypto = require('crypto');

const getGyms = catchAsync(async (req, res) => {
  const { search } = req.query;
  // FIXED: add search + limit to prevent loading 1000+ gyms on login page
  let sql = 'SELECT id, name, slug, address FROM gyms WHERE is_active=true';
  const params = [];
  if (search) {
    sql += ' AND name ILIKE $1';
    params.push(`%${search.trim()}%`);
  }
  sql += ' ORDER BY name LIMIT 100';
  const r = await query(sql, params);
  res.json({ success: true, data: { gyms: r.rows } });
});

const register = catchAsync(async (req, res) => {
  const { name, email, phone, password, gym_id } = req.body;
  const gym = await query('SELECT id FROM gyms WHERE id=$1 AND is_active=true', [gym_id]);
  if (!gym.rows.length) throw AppError.notFound('Gym not found');
  const exists = await query('SELECT id FROM members WHERE email=$1 AND gym_id=$2', [email.toLowerCase(), gym_id]);
  if (exists.rows.length) throw AppError.conflict('Email already registered for this gym');
  const hash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS || '12'));
  const qrToken = 'MBR-' + Date.now() + '-' + crypto.randomBytes(8).toString('hex').toUpperCase();
  const r = await query(`INSERT INTO members (name,email,phone,password_hash,role,gym_id,status,member_type,qr_token) VALUES ($1,$2,$3,$4,'member',$5,'pending','regular',$6) RETURNING id, name, email, status`, [name, email.toLowerCase(), phone||null, hash, gym_id, qrToken]);
  res.status(201).json({ success: true, message: 'Registration submitted. Awaiting admin approval.', data: r.rows[0] });
});

module.exports = { getGyms, register };
