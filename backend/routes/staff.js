'use strict';
const router = require('express').Router();
const c = require('../controllers/staffController');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

router.use(authenticate, requireRole('admin'));
router.get('/',               c.getStaff);
router.post('/',              validate(schemas.createStaff), c.createStaff);
router.put('/:id/permissions', validate(schemas.idParam), c.updateStaffPermissions);
router.delete('/:id',         validate(schemas.idParam), c.deleteStaff);
module.exports = router;
