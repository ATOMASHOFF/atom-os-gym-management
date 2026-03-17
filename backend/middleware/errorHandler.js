'use strict';
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

const errorHandler = (err, req, res, next) => {
  const requestId = req.id || 'unknown';

  // Normalize Postgres errors
  if (err.code === '23505') {
    err = AppError.conflict('This record already exists (duplicate)');
  } else if (err.code === '23503') {
    err = AppError.badRequest('Referenced record does not exist');
  } else if (err.code === '22P02') {
    err = AppError.badRequest('Invalid data format');
  }

  const isOperational = err.isOperational === true;
  const status = err.statusCode || 500;

  // Log all errors; only log stack for unexpected ones
  const logData = {
    requestId,
    method: req.method,
    path: req.path,
    statusCode: status,
    message: err.message,
    userId: req.user?.id,
    gymId: req.gymId,
  };

  if (isOperational) {
    logger.warn('Operational error', logData);
  } else {
    logger.error('Unexpected error', { ...logData, stack: err.stack });
  }

  // Never expose stack traces in production
  const body = {
    success: false,
    message: isOperational ? err.message : 'An unexpected error occurred',
    code: err.code || 'INTERNAL_ERROR',
    requestId,
  };

  if (process.env.NODE_ENV === 'development' && !isOperational) {
    body.stack = err.stack;
  }

  res.status(status).json(body);
};

// Catch async errors without try/catch in controllers
const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { errorHandler, catchAsync };
