'use strict';
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const { query, audit } = require('../config/database');
const AppError = require('../utils/AppError');
const { catchAsync } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// Warn on startup if FRONTEND_URL is pointing to localhost in production
// (this causes QR check-in links to embed localhost URLs that members can't scan)
if (process.env.NODE_ENV === 'production') {
  const furl = process.env.FRONTEND_URL || '';
  if (!furl || furl.includes('localhost') || furl.includes('127.0.0.1')) {
    logger.warn(
      '⚠  FRONTEND_URL is not set or points to localhost — generated QR codes will contain unusable check-in links! ' +
      'Set FRONTEND_URL to your deployed frontend domain (e.g. https://your-app.pages.dev).'
    );
  }
}

const getQRCodes = catchAsync(async (req, res) => {
  const gymId = Number(req.gymId);
  const r = await query('SELECT * FROM gym_qr_codes WHERE gym_id=$1 ORDER BY created_at DESC', [gymId]);
  res.json({ success: true, data: { qr_codes: r.rows } });
});
const generateQRCode = catchAsync(async (req, res) => {
  const { location = 'Main Entrance' } = req.body;
  const token = uuidv4();
  const frontendUrl = process.env.FRONTEND_URL || 'https://atom-fitness-app.onrender.com';
  const qrData = `${frontendUrl}/checkin?token=${token}`;
  const qrImageData = await QRCode.toDataURL(qrData, { width: 300, margin: 2, errorCorrectionLevel: 'M' });
  const r = await query(`INSERT INTO gym_qr_codes (token,qr_image_data,gym_id,location) VALUES ($1,$2,$3,$4) RETURNING *`, [token, qrImageData, req.gymId, location]);
  res.status(201).json({ success: true, data: r.rows[0] });
});
const updateQRCode = catchAsync(async (req, res) => {
  const { location, is_active } = req.body;
  const r = await query(`UPDATE gym_qr_codes SET location=COALESCE($1,location), is_active=COALESCE($2,is_active), updated_at=NOW() WHERE id=$3 AND gym_id=$4 RETURNING *`, [location, is_active, req.params.id, req.gymId]);
  if (!r.rows.length) throw AppError.notFound('QR code not found');
  res.json({ success: true, data: r.rows[0] });
});
const deleteQRCode = catchAsync(async (req, res) => {
  const r = await query('DELETE FROM gym_qr_codes WHERE id=$1 AND gym_id=$2 RETURNING id', [req.params.id, req.gymId]);
  if (!r.rows.length) throw AppError.notFound('QR code not found');
  res.json({ success: true, message: 'QR code deleted' });
});
module.exports = { getQRCodes, generateQRCode, updateQRCode, deleteQRCode };
