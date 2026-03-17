'use strict';
const router = require('express').Router();
const c = require('../controllers/gymController');
const { onboardingStatus } = require('../controllers/importController');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

router.get('/all',            c.getAllGyms);
router.get('/current',        authenticate, c.getCurrentGym);
router.put('/current',        authenticate, requireRole('admin'), validate(schemas.updateGym), c.updateGym);
router.get('/onboarding',     authenticate, requireRole('admin'), onboardingStatus);
module.exports = router;
