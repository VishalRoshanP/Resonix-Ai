/**
 * Input Sanitization Middleware
 * Cleanses req.body, req.query, and req.params against NoSQL query operator injection ($)
 * and malicious HTML script tags (<script>).
 */
const sanitizeValue = (value) => {
  if (typeof value === 'string') {
    // 1. Strip script tags and content
    let clean = value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    // 2. Strip dangerous embedded tags (iframe, object, embed, etc.)
    clean = clean.replace(/<\/?(iframe|object|embed|applet|meta|link|style)\b[^>]*>/gi, '');
    // 3. Strip inline HTML event handlers (e.g., onerror=, onload=, onclick=)
    clean = clean.replace(/\bon\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '');
    // 4. Neutralize javascript: pseudo-protocol URIs
    clean = clean.replace(/javascript\s*:/gi, 'blocked-scheme:');
    return clean;
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const cleanObj = {};
    for (const key of Object.keys(value)) {
      // Prevent NoSQL query injection by stripping keys starting with $ or containing .
      if (key.startsWith('$') || key.includes('.')) {
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
