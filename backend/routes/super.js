'use strict';
const router = require('express').Router();
const c = require('../controllers/superAdminController');
const { authenticate, requireSuperAdmin } = require('../middleware/auth');
const { body, param, query: qv } = require('express-validator');
const { validate } = require('../middleware/validate');

// All super admin routes — authenticate + super_admin role check
router.use(authenticate, requireSuperAdmin);

// ── Platform overview ─────────────────────────────────────────
router.get('/stats', c.getPlatformStats);

// ── Gym list + create ─────────────────────────────────────────
router.get('/gyms', validate([
  qv('search').optional().trim(),
  qv('is_active').optional(),
]), c.listGyms);

router.post('/gyms', validate([
  body('gym_name').trim().notEmpty().withMessage('Gym name is required'),
  body('gym_slug').trim().matches(/^[a-z0-9-]+$/).withMessage('Slug must be lowercase letters, numbers, hyphens only'),
  body('admin_name').trim().notEmpty().withMessage('Admin name is required'),
  body('admin_email').isEmail().normalizeEmail().withMessage('Valid admin email is required'),
  body('admin_password').isLength({ min: 8 }).withMessage('Admin password must be at least 8 characters'),
  body('gym_plan').optional().isIn(['starter', 'pro', 'enterprise']),
]), c.createGym);

// ── Single gym detail + update ────────────────────────────────
router.get('/gyms/:gymId',   validate([param('gymId').isInt({ min: 1 }).toInt()]), c.getGym);
router.put('/gyms/:gymId',   validate([param('gymId').isInt({ min: 1 }).toInt()]), c.updateGym);
router.patch('/gyms/:gymId/toggle', validate([param('gymId').isInt({ min: 1 }).toInt()]), c.toggleGym);

// ── Gym members (super admin can see any gym's members) ───────
router.get('/gyms/:gymId/members', validate([
  param('gymId').isInt({ min: 1 }).toInt(),
]), c.getGymMembers);

// ── Gym admin management ──────────────────────────────────────
router.post('/gyms/:gymId/admins', validate([
  param('gymId').isInt({ min: 1 }).toInt(),
  body('name').trim().notEmpty().withMessage('Name required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password min 8 characters'),
]), c.createGymAdmin);

// Reset an admin's password — note: adminId comes from URL param
router.post('/gyms/:gymId/admins/:adminId/reset-password', validate([
  param('gymId').isInt({ min: 1 }).toInt(),
  param('adminId').isInt({ min: 1 }).toInt(),
  body('new_password').isLength({ min: 8 }).withMessage('Password min 8 characters'),
]), c.resetAdminPassword);

// ── Audit log ─────────────────────────────────────────────────
router.get('/gyms/:gymId/audit', validate([
  param('gymId').isInt({ min: 1 }).toInt(),
]), c.getGymAuditLog);

module.exports = router;
