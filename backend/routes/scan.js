'use strict';
const router = require('express').Router();
const { getMemberQR, scanMemberQR, scanGymQR } = require('../controllers/scanController');
const { authenticate, requireRole } = require('../middleware/auth');
const { scanLimiter } = require('../middleware/rateLimiter');
const { validate, schemas } = require('../middleware/validate');

router.use(authenticate);
router.get('/member-qr/:id',   validate(schemas.idParam),  getMemberQR);
router.post('/scan-member',    requireRole('admin','staff'), scanLimiter, validate(schemas.scanMember), scanMemberQR);
router.post('/scan-gym',       scanLimiter, validate(schemas.scanMember), scanGymQR);

module.exports = router;
