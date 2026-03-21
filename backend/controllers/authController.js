'use strict';
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { query, audit } = require('../config/database');
const AppError = require('../utils/AppError');
const { catchAsync } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// Valid 60-char bcrypt hash for "dummy" — prevents timing attacks
// when email is not found. Generated with bcrypt.hashSync('dummy',12).
const DUMMY_HASH = '$2a$12$Iqf7R5DGHg9h3LqXDVqQNO5RcfZ1X8OEdZP6HJlLlMGP1sP8EFKEC';

const generateToken = (user, isSuperAdmin = false) => jwt.sign(
  {
    userId:       user.id,
    email:        user.email,
    role:         isSuperAdmin ? 'super_admin' : user.role,
    gymId:        user.gym_id || null,
    isSuperAdmin,
  },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || '7d', issuer: 'atom-fitness' }
);

// ── Login ─────────────────────────────────────────────────────
const login = catchAsync(async (req, res) => {
  const { email, password, gym_id } = req.body;
  const ip = req.ip || req.headers['x-forwarded-for'];

  // Normalize email the same way validator does — just lowercase + trim
  const normalizedEmail = email.toString().toLowerCase().trim();

  // ── 1. Check super_admins table first ────────────────────────
  let saResult;
  try {
    saResult = await query(
      'SELECT * FROM super_admins WHERE LOWER(TRIM(email)) = $1 AND is_active = true',
      [normalizedEmail]
    );
  } catch (err) {
    logger.error('super_admins query failed', { error: err.message });
    saResult = { rows: [] };
  }

  if (saResult.rows.length) {
    const sa = saResult.rows[0];
    let valid = false;
    try {
      valid = await bcrypt.compare(password, sa.password_hash);
    } catch (err) {
      logger.error('bcrypt compare failed for super admin', { error: err.message });
      throw AppError.internal('Authentication error — please contact support');
    }

    if (!valid) {
      logger.warn('Failed super_admin login', { email: normalizedEmail, ip });
      throw AppError.unauthorized('Invalid email or password');
    }

    await query('UPDATE super_admins SET last_login_at = NOW() WHERE id = $1', [sa.id]).catch(() => {});
    const token = generateToken(sa, true);
    const { password_hash, ...safeSA } = sa;
    logger.info('Super admin logged in', { id: sa.id, email: sa.email });
    return res.json({ success: true, token, user: { ...safeSA, role: 'super_admin' } });
  }

  // ── 2. Check members table ───────────────────────────────────
  let sql = `SELECT m.*, g.name as gym_name, g.slug as gym_slug
             FROM members m LEFT JOIN gyms g ON m.gym_id = g.id
             WHERE LOWER(TRIM(m.email)) = $1 AND m.is_active = true`;
  const params = [normalizedEmail];
  if (gym_id) { sql += ' AND m.gym_id = $2'; params.push(gym_id); }

  const result = await query(sql, params);
  const user = result.rows[0] || null;

  // Always run bcrypt compare — constant time regardless of whether user found
  let valid = false;
  try {
    valid = await bcrypt.compare(password, user?.password_hash || DUMMY_HASH);
  } catch (err) {
    // If hash is malformed in DB, still return invalid credentials (don't leak info)
    logger.error('bcrypt compare failed', { error: err.message });
    valid = false;
  }

  if (!user || !valid) {
    logger.warn('Failed login', { email: normalizedEmail, ip });
    throw AppError.unauthorized('Invalid email or password');
  }

  const statusMsg = {
    pending:   'Account pending admin approval',
    suspended: 'Account suspended — contact your gym',
    inactive:  'Account inactive — contact your gym',
  };
  if (statusMsg[user.status]) throw AppError.unauthorized(statusMsg[user.status]);

  await query('UPDATE members SET last_login_at = NOW() WHERE id = $1', [user.id]).catch(() => {});
  await audit(user.gym_id, user.id, user.role, 'LOGIN', 'members', user.id,
    null, null, ip, req.id).catch(() => {});

  const token = generateToken(user, false);
  const { password_hash, ...safeUser } = user;
  logger.info('Member logged in', { id: user.id, role: user.role, gymId: user.gym_id });
  res.json({ success: true, token, user: safeUser });
});

// ── Get current user ─────────────────────────────────────────
const getMe = catchAsync(async (req, res) => {
  if (req.isSuperAdmin) {
    const r = await query(
      'SELECT id, name, email, created_at, last_login_at FROM super_admins WHERE id = $1',
      [req.user.id]
    );
    if (!r.rows.length) throw AppError.notFound('User not found');
    return res.json({ success: true, data: { ...r.rows[0], role: 'super_admin' } });
  }

  const result = await query(
    `SELECT m.id, m.name, m.email, m.phone, m.role, m.gym_id, m.status, m.member_type,
            m.date_of_birth, m.address, m.emergency_contact, m.notes,
            m.created_at, m.last_login_at,
            g.name as gym_name, g.slug as gym_slug,
            g.address as gym_address, g.is_active as gym_active
     FROM members m LEFT JOIN gyms g ON m.gym_id = g.id
     WHERE m.id = $1 AND m.is_active = true`,
    [req.user.id]
  );
  if (!result.rows.length) throw AppError.notFound('User not found');

  let userData = result.rows[0];
  if (req.user.role === 'staff') {
    const perms = await query(
      'SELECT * FROM staff_permissions WHERE staff_id = $1 AND gym_id = $2',
      [req.user.id, req.gymId]
    );
    userData.permissions = perms.rows[0] || {};
  }
  res.json({ success: true, data: userData });
});

// ── Change password ───────────────────────────────────────────
const changePassword = catchAsync(async (req, res) => {
  const { current_password, new_password } = req.body;
  const table = req.isSuperAdmin ? 'super_admins' : 'members';

  const r = await query(`SELECT password_hash FROM ${table} WHERE id = $1`, [req.user.id]);
  if (!r.rows.length) throw AppError.notFound('User not found');

  const valid = await bcrypt.compare(current_password, r.rows[0].password_hash);
  if (!valid) throw AppError.unauthorized('Current password is incorrect');

  const hash = await bcrypt.hash(new_password, parseInt(process.env.BCRYPT_ROUNDS || '12'));
  await query(
    `UPDATE ${table} SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
    [hash, req.user.id]
  );

  res.json({ success: true, message: 'Password updated successfully' });
});

module.exports = { login, getMe, changePassword };
