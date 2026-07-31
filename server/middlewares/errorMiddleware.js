const ApiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');

/**
 * Global Error Handling Middleware
 * Catches operational ApiErrors, Mongoose validation/cast errors, JWT errors,
 * and internal server exceptions, returning uniform JSON error responses.
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Mongoose Bad ObjectId (CastError)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Resource not found with ID: ${err.value}`;
  }

  // Mongoose Duplicate Key Error
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue || {})[0] || 'Field';
    message = `Duplicate field value entered for '${field}'. Please use another value.`;
  }

  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors || {})
      .map((val) => val.message)
      .join(', ');
  }

  // JWT Verification Errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token. Please log in again.';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token expired. Please log in again.';
  }

  logger.error(`[Global Error] ${statusCode} - ${message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);

  if (process.env.NODE_ENV === 'development') {
    return res.status(statusCode).json({
      status: `${statusCode}`.startsWith('4') ? 'fail' : 'error',
      message,
      stack: err.stack,
      error: err,
    });
  }

  return ApiResponse.error(res, statusCode, message);
};

module.exports = errorHandler;
