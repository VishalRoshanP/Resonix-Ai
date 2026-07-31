const rateLimit = require('express-rate-limit');
const ApiResponse = require('../utils/apiResponse');

/**
 * Rate Limiting Middleware
 * Prevents brute force and denial of service attacks by limiting request rates.
 */
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 200, // Limit each IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return ApiResponse.error(
      res,
      429,
      'Too many requests from this IP address. Please try again after 15 minutes.'
    );
  },
});

module.exports = apiLimiter;
