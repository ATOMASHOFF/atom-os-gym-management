'use strict';
const router = require('express').Router();
const c = require('../controllers/memberController');
const { authenticate, requireRole, requirePermission } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

router.use(authenticate);

// Admin only
router.get('/dashboard-stats',  requireRole('admin'),                                        c.getDashboardStats);
router.get('/pending',          requireRole('admin'),                                        c.getPendingMembers);
router.post('/:id/approve',     requireRole('admin'),     validate(schemas.idParam),         c.approveRegistration);
router.post('/:id/reject',      requireRole('admin'),     validate(schemas.idParam),         c.rejectRegistration);

// FIXED: Added role check — members cannot list or view other members
router.get('/',    requireRole('admin', 'staff'),   validate(schemas.pagination),            c.getMembers);
router.get('/:id', requireRole('admin', 'staff'),   validate(schemas.idParam),               c.getMember);

router.post('/',   requireRole('admin', 'staff'),   validate(schemas.createMember),          c.createMember);
router.put('/:id', requireRole('admin', 'staff'),   validate(schemas.updateMember),          c.updateMember);
router.delete('/:id', requireRole('admin'),         validate(schemas.idParam),               c.deleteMember);

module.exports = router;
