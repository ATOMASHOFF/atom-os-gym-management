'use strict';
const router = require('express').Router();
const { bulkImport, downloadTemplate, importStatus } = require('../controllers/importController');
const { authenticate, requireRole } = require('../middleware/auth');
const { body, query: qv } = require('express-validator');
const { validate } = require('../middleware/validate');
const { apiLimiter } = require('../middleware/rateLimiter');

router.use(authenticate, requireRole('admin'));

// Download blank CSV template
router.get('/template', downloadTemplate);

// Current import stats
router.get('/status', importStatus);

// Bulk import members
router.post('/members',
  apiLimiter,
  validate([
    body('rows').isArray({ min: 1, max: 500 }).withMessage('rows must be array of 1-500 items'),
    body('options.skip_duplicates').optional().isBoolean().toBoolean(),
    body('options.dry_run').optional().isBoolean().toBoolean(),
    body('options.default_password').optional().isString().isLength({ min: 6, max: 50 }),
  ]),
  bulkImport
);

module.exports = router;

const { detectHeaders } = require('../controllers/importController');
router.post('/detect-headers', validate([
  body('headers').isArray({ min: 1 }).withMessage('headers array required'),
]), detectHeaders);
