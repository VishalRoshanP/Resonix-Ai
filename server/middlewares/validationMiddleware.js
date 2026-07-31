const ApiError = require('../utils/apiError');

/**
 * Request Validation Middleware
 * Executes provided validation schema function against req.body
 * and returns standardized 400 ApiError if validation fails.
 */
const validate = (schema) => {
  return (req, res, next) => {
    if (typeof schema !== 'function') {
      return next();
    }
    const { error } = schema(req.body);
    if (error) {
      return next(new ApiError(400, typeof error === 'string' ? error : 'Invalid request payload'));
    }
    next();
  };
};

module.exports = validate;
