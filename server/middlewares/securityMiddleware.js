const helmet = require('helmet');

/**
 * Helmet Security Headers Middleware
 * Protects HTTP headers against common security vulnerabilities.
 */
const securityMiddleware = helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production',
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: { maxAge: 31536000, includeSubDomains: true },
  ieNoOpen: true,
  noSniff: true,
  referrerPolicy: { policy: 'no-referrer' },
  xssFilter: true,
});

module.exports = securityMiddleware;
