const express = require('express');
const compression = require('compression');
const path = require('path');
const cookieParser = require('cookie-parser');

// Custom Global Middlewares
const securityMiddleware = require('./middlewares/securityMiddleware');
const corsMiddleware = require('./middlewares/corsMiddleware');
const requestLogger = require('./middlewares/loggerMiddleware');
const apiLimiter = require('./middlewares/rateLimitMiddleware');
const sanitizationMiddleware = require('./middlewares/sanitizationMiddleware');
const responseMiddleware = require('./middlewares/responseMiddleware');
const notFoundHandler = require('./middlewares/notFoundMiddleware');
const errorHandler = require('./middlewares/errorMiddleware');

// API Router
const apiRouter = require('./routes/apiRouter');

const app = express();

// Disable HTTP ETags to ensure dynamic APIs always return HTTP 200 OK
app.set('etag', false);

// 1. Security HTTP Headers
app.use(securityMiddleware);

// 2. Enable Cross-Origin Resource Sharing
app.use(corsMiddleware);

// 3. HTTP Request Logging (Morgan -> Winston)
app.use(requestLogger);

// 4. Rate Limiting for API Protection
app.use('/api', apiLimiter);

// 5. Body Parsers & Request Payload Limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// 6. NoSQL & XSS Input Sanitization
app.use(sanitizationMiddleware);

// 7. Centralized Response Formatting Helper
app.use(responseMiddleware);

// 8. Response Compression
app.use(compression());

// 9. Static Assets & Uploads Directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 10. API Routes
app.use('/api/v1', apiRouter);
app.use('/api', apiRouter); // Alias for convenience

// Root Status Endpoint
app.get('/', (req, res) => {
  return res.success(
    {
      name: 'RESONIX AI Backend API',
      version: '1.0.0',
      status: 'Operational',
      gemmaVersion: 'Powered by Gemma 4',
      documentation: '/api/v1/health',
    },
    'RESONIX AI Service Ready'
  );
});

// 11. 404 Route Not Found Handler
app.use(notFoundHandler);

// 12. Global Error Handling Middleware
app.use(errorHandler);

module.exports = app;
