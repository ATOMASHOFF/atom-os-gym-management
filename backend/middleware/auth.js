'use strict';
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const AppError = require('../utils/AppError');

// Allowlist for requirePermission — prevents SQL injection via dynamic column names
const VALID_PERMISSIONS = new Set([
  'can_scan_attendance',
  'can_view_members',
  'can_add_members',
  'can_edit_members',
  'can_delete_members',
  'can_view_subscriptions',
  'can_add_subscriptions',
  'can_view_attendance',
  'can_view_reports',
  'can_view_financial',
]);

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return next(AppError.unauthorized('No token provided'));
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.isSuperAdmin) {
      const result = await query(
        'SELECT id, name, email FROM super_admins WHERE id = $1 AND is_active = true',
        [decoded.userId]
      );
      if (!result.rows.length) return next(AppError.unauthorized('Account not found'));
      req.user = { ...result.rows[0], role: 'super_admin', gym_id: null };
      req.gymId = null;
      req.isSuperAdmin = true;
    } else {
      const result = await query(
        'SELECT id, name, email, role, gym_id, status FROM members WHERE id = $1 AND is_active = true',
        [decoded.userId]
      );
      if (!result.rows.length) return next(AppError.unauthorized('Account not found'));
      const user = result.rows[0];
      if (user.status === 'suspended') return next(AppError.unauthorized('Account suspended — contact your gym'));
      if (user.status === 'inactive')  return next(AppError.unauthorized('Account inactive — contact your gym'));
      req.user = user;
      req.gymId = user.gym_id;
      req.isSuperAdmin = false;
    }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return next(AppError.unauthorized('Session expired — please sign in again'));
    return next(AppError.unauthorized('Invalid token'));
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (req.isSuperAdmin) return next();
  if (!roles.includes(req.user.role)) {
    return next(AppError.forbidden(`Access denied`));
  }
  next();
};

const requireSuperAdmin = (req, res, next) => {
  if (!req.isSuperAdmin) return next(AppError.forbidden('Super admin access required'));
  next();
};

const resolveGymId = async (req, res, next) => {
  if (!req.isSuperAdmin) return next();
  const gymId =
    req.headers['x-gym-id'] ||
    req.params.gymId ||
    req.query.gym_id ||
    req.body?.gym_id;
  if (!gymId) return next();
  const result = await query('SELECT id FROM gyms WHERE id = $1 AND is_active = true', [gymId]);
  if (!result.rows.length) return next(AppError.notFound('Gym not found'));
  req.gymId = parseInt(gymId);
  next();
};

// FIXED: SQL injection via dynamic column name — now uses allowlist
const requirePermission = (permission) => async (req, res, next) => {
  if (req.isSuperAdmin || req.user.role === 'admin') return next();

  // Validate permission is a known column — prevents SQL injection
  if (!VALID_PERMISSIONS.has(permission)) {
    return next(AppError.forbidden('Unknown permission'));
  }

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
