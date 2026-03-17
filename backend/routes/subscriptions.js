'use strict';
const router = require('express').Router();
const c = require('../controllers/subscriptionController');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

router.use(authenticate);
router.get('/',     validate(schemas.pagination),              c.getSubscriptions);
router.post('/',    requireRole('admin','staff'), validate(schemas.createSubscription), c.createSubscription);
router.get('/:id',  validate(schemas.idParam),                 c.getSubscription);
router.put('/:id',  requireRole('admin','staff'), validate(schemas.idParam), c.updateSubscription);
router.delete('/:id', requireRole('admin'), validate(schemas.idParam), c.cancelSubscription);
module.exports = router;
