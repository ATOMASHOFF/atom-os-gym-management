'use strict';
const router = require('express').Router();
const c = require('../controllers/memberController');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

router.use(authenticate);
router.get('/dashboard-stats',   requireRole('admin'),               c.getDashboardStats);
router.get('/pending',           requireRole('admin'),               c.getPendingMembers);
router.post('/:id/approve',      requireRole('admin'), validate(schemas.idParam), c.approveRegistration);
router.post('/:id/reject',       requireRole('admin'), validate(schemas.idParam), c.rejectRegistration);
router.get('/',                  validate(schemas.pagination),       c.getMembers);
router.post('/',                 requireRole('admin','staff'), validate(schemas.createMember), c.createMember);
router.get('/:id',               validate(schemas.idParam),          c.getMember);
router.put('/:id',               requireRole('admin','staff'), validate(schemas.updateMember), c.updateMember);
router.delete('/:id',            requireRole('admin'),  validate(schemas.idParam), c.deleteMember);

module.exports = router;
