'use strict';
class AppError extends Error {
  constructor(message, statusCode = 500, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;   // vs programmer errors
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(msg, code)   { return new AppError(msg, 400, code); }
  static unauthorized(msg)       { return new AppError(msg, 401, 'UNAUTHORIZED'); }
  static forbidden(msg)          { return new AppError(msg, 403, 'FORBIDDEN'); }
  static notFound(msg)           { return new AppError(msg, 404, 'NOT_FOUND'); }
  static conflict(msg)           { return new AppError(msg, 409, 'CONFLICT'); }
  static tooMany(msg)            { return new AppError(msg, 429, 'RATE_LIMITED'); }
  static internal(msg)           { return new AppError(msg, 500, 'INTERNAL'); }
}

module.exports = AppError;
