/**
 * Input Sanitization Middleware
 * Cleanses req.body, req.query, and req.params against NoSQL query operator injection ($)
 * and malicious HTML script tags (<script>).
 */
const sanitizeValue = (value) => {
  if (typeof value === 'string') {
    // Strip script tags and potential script injections
    let clean = value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    return clean;
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const cleanObj = {};
    for (const key of Object.keys(value)) {
      // Prevent NoSQL query injection by stripping keys starting with $
      if (key.startsWith('$')) {
        continue;
      }
      cleanObj[key] = sanitizeValue(value[key]);
    }
    return cleanObj;
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  return value;
};

const sanitizationMiddleware = (req, res, next) => {
  if (req.body) req.body = sanitizeValue(req.body);
  if (req.query) req.query = sanitizeValue(req.query);
  if (req.params) req.params = sanitizeValue(req.params);
  next();
};

module.exports = sanitizationMiddleware;
