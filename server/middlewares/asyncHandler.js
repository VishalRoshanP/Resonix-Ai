/**
 * Async Error Wrapper Middleware
 * Wraps async functions to catch any unhandled promise rejections
 * and forward them to Express global error handler.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
