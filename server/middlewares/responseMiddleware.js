const ApiResponse = require('../utils/apiResponse');

/**
 * Response Formatter Middleware
 * Attaches helper functions res.success and res.error to the response object
 * to ensure uniform JSON responses across all controllers.
 */
const responseMiddleware = (req, res, next) => {
  res.success = (data = null, message = 'Success', statusCode = 200) => {
    return ApiResponse.success(res, statusCode, message, data);
  };

  res.error = (message = 'Internal Server Error', statusCode = 500, errors = null) => {
    return ApiResponse.error(res, statusCode, message, errors);
  };

  next();
};

module.exports = responseMiddleware;
