const ApiError = require('../utils/apiError');

/**
 * 404 Route Not Found Middleware
 * Handles requests to undefined routes and forwards a 404 ApiError.
 */
const notFoundHandler = (req, res, next) => {
  next(new ApiError(404, `Resource not found: Cannot ${req.method} ${req.originalUrl}`));
};

module.exports = notFoundHandler;
