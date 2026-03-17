'use strict';
const router = require('express').Router();
const c = require('../controllers/planController');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

router.use(authenticate);
router.get('/',     c.getPlans);
router.post('/',    requireRole('admin'), validate(schemas.createPlan), c.createPlan);
router.put('/:id',  requireRole('admin'), validate([...schemas.idParam, ...schemas.createPlan.map(v => v.optional())]), c.updatePlan);
router.delete('/:id', requireRole('admin'), validate(schemas.idParam), c.deletePlan);
module.exports = router;
