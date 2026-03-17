'use strict';
const router = require('express').Router();
const { getGyms, register } = require('../controllers/publicController');
const { publicLimiter, authLimiter } = require('../middleware/rateLimiter');
const { validate, schemas } = require('../middleware/validate');

router.get('/gyms',     publicLimiter, getGyms);
router.post('/register', authLimiter, validate(schemas.register), register);

module.exports = router;
