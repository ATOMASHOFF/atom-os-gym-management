'use strict';
const router = require('express').Router();
const c = require('../controllers/attendanceController');
const { authenticate } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

router.use(authenticate);
router.get('/',             validate(schemas.pagination), c.getAttendance);
router.get('/today',        c.getTodayAttendance);
router.post('/checkin',     validate(schemas.manualCheckin), c.manualCheckIn);
router.post('/qr-checkin',  validate(schemas.scanMember), c.qrCheckIn);
router.get('/member/:id',   validate(schemas.idParam), c.getMemberAttendance);
module.exports = router;
