'use strict';
const router = require('express').Router();
const c = require('../controllers/gymQRController');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

router.use(authenticate);
router.get('/',           c.getQRCodes);
router.post('/generate',  requireRole('admin','staff'), validate(schemas.generateQR), c.generateQRCode);
router.put('/:id',        requireRole('admin'), validate(schemas.idParam), c.updateQRCode);
router.delete('/:id',     requireRole('admin'), validate(schemas.idParam), c.deleteQRCode);
module.exports = router;
