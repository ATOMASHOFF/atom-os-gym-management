'use strict';
const { body, param, query, validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

// Run validation and return 422 if errors
const validate = (validations) => async (req, res, next) => {
  await Promise.all(validations.map(v => v.run(req)));
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map(e => `${e.path}: ${e.msg}`).join('; ');
    return next(AppError.badRequest(messages, 'VALIDATION_ERROR'));
  }
  next();
};

// ── Schema definitions ─────────────────────────────────────────────────────
const schemas = {
  login: [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 1 }).withMessage('Password required'),
    body('gym_id').optional().isInt({ min: 1 }).toInt(),
  ],

  register: [
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6, max: 100 }).withMessage('Password must be 6-100 characters'),
    body('phone').optional().trim().isLength({ max: 20 }),
    body('gym_id').isInt({ min: 1 }).toInt().withMessage('Valid gym required'),
  ],

  changePassword: [
    body('current_password').notEmpty().withMessage('Current password required'),
    body('new_password').isLength({ min: 6, max: 100 }).withMessage('New password must be 6-100 characters'),
  ],

  createMember: [
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6, max: 100 }).withMessage('Password min 6 chars'),
    body('phone').optional().trim().isLength({ max: 20 }),
    body('role').optional().isIn(['member', 'staff', 'admin']),
    body('member_type').optional().isIn(['regular', 'guest', 'trial']),
    body('date_of_birth').optional().isDate(),
  ],

  updateMember: [
    param('id').isInt({ min: 1 }).toInt(),
    body('name').optional().trim().isLength({ min: 2, max: 100 }),
    body('phone').optional().trim().isLength({ max: 20 }),
    body('status').optional().isIn(['active', 'inactive', 'suspended']),
    body('member_type').optional().isIn(['regular', 'guest', 'trial']),
  ],

  createSubscription: [
    body('member_id').isInt({ min: 1 }).toInt().withMessage('Valid member required'),
    body('plan_id').isInt({ min: 1 }).toInt().withMessage('Valid plan required'),
    body('start_date').isDate().withMessage('Valid start date required'),
    body('end_date').isDate().withMessage('Valid end date required'),
    body('payment_method').optional().isIn(['cash', 'upi', 'card', 'bank_transfer', 'online', 'other']),
    body('amount_paid').optional().isFloat({ min: 0 }),
  ],

  createPlan: [
    body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Plan name required'),
    body('duration_days').isInt({ min: 1, max: 3650 }).toInt().withMessage('Duration must be 1-3650 days'),
    body('price').isFloat({ min: 0 }).withMessage('Valid price required'),
    body('description').optional().trim().isLength({ max: 500 }),
  ],

  createStaff: [
    body('name').trim().isLength({ min: 2, max: 100 }),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6, max: 100 }),
    body('phone').optional().trim().isLength({ max: 20 }),
  ],

  idParam: [
    param('id').isInt({ min: 1 }).toInt().withMessage('Valid ID required'),
  ],

  pagination: [
    query('page').optional().isInt({ min: 1 }).toInt().withMessage('Page must be positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt().withMessage('Limit must be 1-100'),
  ],

  manualCheckin: [
    body('member_id').isInt({ min: 1 }).toInt().withMessage('Valid member ID required'),
  ],

  scanMember: [
    body('qr_token').trim().notEmpty().withMessage('QR token required'),
    body('action').optional().isIn(['view', 'checkin']),
  ],

  generateQR: [
    body('location').optional().trim().isLength({ max: 100 }),
  ],

  updateGym: [
    body('name').optional().trim().isLength({ min: 1, max: 255 }),
    body('owner_name').optional().trim().isLength({ max: 255 }),
    body('owner_email').optional().isEmail().normalizeEmail(),
    body('owner_phone').optional().trim().isLength({ max: 20 }),
    body('address').optional().trim().isLength({ max: 500 }),
  ],
};

module.exports = { validate, schemas };

// Already exported above — this file has all schemas.
// Note: import validation is inline in routes/import.js
