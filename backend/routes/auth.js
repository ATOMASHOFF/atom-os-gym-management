'use strict';
const router = require('express').Router();
const { login, getMe, changePassword } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const { validate, schemas } = require('../middleware/validate');

router.post('/login',           authLimiter, validate(schemas.login),          login);
router.get('/me',               authenticate,                                   getMe);
router.post('/change-password', authenticate, validate(schemas.changePassword), changePassword);

module.exports = router;
