const cors = require('cors');

/**
 * CORS Security Middleware
 * Restricts cross-origin resource access based on allowed origins.
 * Supports Web browsers, Capacitor Android container origins, and local LAN IPs.
 */
const DEFAULT_ALLOWED = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'capacitor://localhost',
  'http://localhost',
  'https://localhost',
];

const envOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : [];

const isAllowedOrigin = (origin) => {
  // Allow requests with no origin (e.g. mobile native apps, curl, Postman)
  if (!origin) return true;

  if (envOrigins.includes('*') || envOrigins.includes(origin)) return true;
  if (DEFAULT_ALLOWED.includes(origin)) return true;

  // Allow Capacitor Android native container origins
  if (
    origin.startsWith('capacitor://') ||
    origin.startsWith('http://localhost') ||
    origin.startsWith('https://localhost')
  ) {
    return true;
  }

  // Allow production deployment domains (Render, Vercel, Netlify, GitHub Pages)
  if (
    origin.endsWith('.onrender.com') ||
    origin.endsWith('.vercel.app') ||
    origin.endsWith('.netlify.app') ||
    origin.endsWith('.github.io')
  ) {
    return true;
  }

  return false;
};

const corsMiddleware = cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Rejected Origin: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  optionsSuccessStatus: 200,
});

corsMiddleware.isAllowedOrigin = isAllowedOrigin;

module.exports = corsMiddleware;
