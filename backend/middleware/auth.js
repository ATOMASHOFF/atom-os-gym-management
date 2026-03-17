'use strict';
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const AppError = require('../utils/AppError');

/**
 * authenticate — verifies JWT and populates req.user + req.gymId.
 *
 * Token payload shape:
 *   { userId, email, role, gymId, isSuperAdmin? }
 *
 * Super admins:   req.user.role = 'super_admin', req.gymId = null
 *                 They can access any gym via X-Gym-ID header or :gymId param.
 * Gym members:    req.gymId = their gym from JWT (immutable)
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return next(AppError.unauthorized('No token provided'));
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.isSuperAdmin) {
      // Look up super_admin table
      const result = await query(
        'SELECT id, name, email FROM super_admins WHERE id = $1 AND is_active = true',
        [decoded.userId]
      );
      if (!result.rows.length) return next(AppError.unauthorized('Account not found'));

      req.user = { ...result.rows[0], role: 'super_admin', gym_id: null };
      req.gymId = null;  // Super admin has no default gym — resolved per request
      req.isSuperAdmin = true;
    } else {
      // Regular gym member / admin / staff
      const result = await query(
        'SELECT id, name, email, role, gym_id, status FROM members WHERE id = $1 AND is_active = true',
        [decoded.userId]
      );
      if (!result.rows.length) return next(AppError.unauthorized('Account not found'));

      const user = result.rows[0];
      if (user.status === 'suspended') return next(AppError.unauthorized('Account suspended'));
      if (user.status === 'inactive')  return next(AppError.unauthorized('Account inactive'));

      req.user = user;
      req.gymId = user.gym_id;
      req.isSuperAdmin = false;
    }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return next(AppError.unauthorized('Token expired'));
    return next(AppError.unauthorized('Invalid token'));
  }
};

/**
 * requireRole — allow access only to listed roles.
 * Always allow super_admin unless explicitly excluded.
 */
const requireRole = (...roles) => (req, res, next) => {
  if (req.isSuperAdmin) return next(); // super admin passes everything
  if (!roles.includes(req.user.role)) {
    return next(AppError.forbidden(`Requires role: ${roles.join(' or ')}`));
  }
  next();
};

/**
 * requireSuperAdmin — only platform-level super admins.
 */
const requireSuperAdmin = (req, res, next) => {
  if (!req.isSuperAdmin) return next(AppError.forbidden('Super admin access required'));
  next();
};

/**
 * resolveGymId — for super admin requests, resolve which gym they're acting on.
 * Reads from: X-Gym-ID header, or :gymId URL param, or query ?gym_id=
 * For regular users, their gymId is already set from JWT.
 */
const resolveGymId = async (req, res, next) => {
  if (!req.isSuperAdmin) return next(); // regular users already have gymId

  const gymId =
    req.headers['x-gym-id'] ||
    req.params.gymId ||
    req.query.gym_id ||
    req.body?.gym_id;

  if (!gymId) return next(); // super admin global endpoints don't need a gym

  // Validate gym exists
  const result = await query('SELECT id FROM gyms WHERE id = $1 AND is_active = true', [gymId]);
  if (!result.rows.length) return next(AppError.notFound('Gym not found'));

  req.gymId = parseInt(gymId);
  next();
};

/**
 * requirePermission — staff granular permissions.
 * Admins and super_admins always pass.
 */
const requirePermission = (permission) => async (req, res, next) => {
  if (req.isSuperAdmin || req.user.role === 'admin') return next();
  try {
    const result = await query(
      `SELECT ${permission} FROM staff_permissions WHERE staff_id = $1 AND gym_id = $2`,
      [req.user.id, req.gymId]
    );
    if (!result.rows.length || !result.rows[0][permission]) {
      return next(AppError.forbidden('Permission denied'));
    }
    next();
  } catch (err) { next(err); }
};

module.exports = { authenticate, requireRole, requireSuperAdmin, resolveGymId, requirePermission };
