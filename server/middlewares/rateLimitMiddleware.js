/**
 * RESONIX AI — Server-Side Route-Specific Rate Limiting Middleware
 * 
 * Provides isolated, production-safe rate limiters for:
 * - General API
 * - Authentication (Brute-force protection)
 * - Voice / Speech-to-Text (STT Quota protection: Gemini 3.5 & Sarvam)
 * - Multilingual Translation (Gemini & Sarvam)
 * - AI Reasoning, Triage & Vision Analysis (Gemini 3.8 Flash & Gemma 4)
 * - Text-to-Speech (Gemini/Sarvam TTS)
 * - Emergency SOS & Offline Packet Sync (High-tolerance flood guard)
 * - Health & Liveness Probes (Render / Deployment monitoring)
 */

const { rateLimit } = require('express-rate-limit');
const config = require('../config/rateLimit');
const logger = require('../utils/logger');

// Debounce map to prevent log-flooding during rapid rate-limit violations
const loggedBlocks = new Map();

/**
 * Sanitize identity for safe server-side logging (masks IP or user ID)
 * Strictly zero credential or private payload leakage.
 */
const sanitizeIdentity = (identity) => {
  if (!identity) return 'unknown';
  if (identity.startsWith('user:')) {
    const rawId = identity.slice(5);
    return `user:${rawId.length > 6 ? rawId.slice(0, 4) + '...' + rawId.slice(-2) : rawId}`;
  }
  // IPv4 masking: 192.168.1.5 -> 192.168.1.xxx
  const ipv4Match = identity.match(/(\d+\.\d+\.\d+)\.\d+/);
  if (ipv4Match) return `ip:${ipv4Match[1]}.xxx`;
  if (identity.includes('127.0.0.1') || identity.includes('::1') || identity.includes('localhost')) {
    return 'ip:localhost';
  }
  return identity.substring(0, 16) + '...';
};

/**
 * Log rate-limit violation with debouncing (max once per 10 seconds per category+identity)
 */
const logRateLimitBlock = (category, identity, req) => {
  const now = Date.now();
  const endpoint = req.originalUrl || req.baseUrl + req.path || req.path;
  const logKey = `${category}:${identity}:${endpoint}`;
  const lastLogged = loggedBlocks.get(logKey) || 0;

  if (now - lastLogged > 10000) {
    loggedBlocks.set(logKey, now);

    // Bounded cleanup to prevent memory growth
    if (loggedBlocks.size > 1000) {
      for (const [k, v] of loggedBlocks.entries()) {
        if (now - v > 30000) loggedBlocks.delete(k);
      }
    }

    logger.warn(
      `[RateLimit] ⚠️ 429 Blocked | Category: ${category} | Client: ${sanitizeIdentity(identity)} | Endpoint: ${req.method} ${endpoint}`
    );
  }
};

/**
 * Authoritative Client Key Identifier
 * Prefers authenticated user identity (req.user.id / _id) where available,
 * falling back to server-derived client IP (backed by Express trust-proxy).
 */
const getClientIdentity = (req) => {
  if (req.user && (req.user.id || req.user._id)) {
    return `user:${req.user.id || req.user._id}`;
  }
  return `ip:${req.ip || req.socket?.remoteAddress || 'unknown'}`;
};

/**
 * Reusable Rate Limiter Factory
 */
const createRateLimiter = (options) => {
  const {
    category,
    windowMs,
    max,
    message,
    skip = null,
  } = options;

  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: config.standardHeaders,
    legacyHeaders: config.legacyHeaders,
    keyGenerator: (req) => `${category}:${getClientIdentity(req)}`,
    skip: (req) => {
      if (!config.enabled) return true;
      if (typeof skip === 'function') return skip(req);
      return false;
    },
    handler: (req, res, next, rateLimitOptions) => {
      const identity = getClientIdentity(req);
      logRateLimitBlock(category, identity, req);

      // Calculate accurate Retry-After seconds
      const resetTime = req.rateLimit?.resetTime;
      const retryAfterSeconds = resetTime
        ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
        : Math.ceil(windowMs / 1000);

      // Set standard HTTP Retry-After header
      res.setHeader('Retry-After', String(retryAfterSeconds));

      // Return consistent Resonix HTTP 429 JSON response
      return res.status(429).json({
        status: 'fail',
        success: false,
        message: message || 'Too many requests. Please try again later.',
        error: {
          code: 'RATE_LIMITED',
          message: message || 'Too many requests. Please try again later.',
          limitCategory: category,
          retryAfterSeconds,
        },
        errors: {
          code: 'RATE_LIMITED',
          message: message || 'Too many requests. Please try again later.',
          limitCategory: category,
          retryAfterSeconds,
        },
      });
    },
  });
};

// 1. General API Gateway Limiter (Mounted on /api)
const generalLimiter = createRateLimiter({
  category: config.general.category,
  windowMs: config.general.windowMs,
  max: config.general.max,
  message: config.general.message,
  skip: (req) => {
    // Health and readiness endpoints are excluded from general API consumption
    const path = req.path || '';
    const url = req.originalUrl || '';
    return (
      path === '/health' ||
      path === '/status' ||
      path === '/version' ||
      url.includes('/health') ||
      url.includes('/status') ||
      url.includes('/version')
    );
  },
});

// 2. Authentication & Login Protection (Brute-Force Guard)
const authLimiter = createRateLimiter({
  category: config.auth.category,
  windowMs: config.auth.windowMs,
  max: config.auth.max,
  message: config.auth.message,
});

// 3. Voice & Speech-to-Text Limiter (Protects Gemini 3.5 & Sarvam STT)
const voiceLimiter = createRateLimiter({
  category: config.voice.category,
  windowMs: config.voice.windowMs,
  max: config.voice.max,
  message: config.voice.message,
});

// 4. Multilingual Translation Limiter (Protects Gemini & Sarvam Translation)
const translationLimiter = createRateLimiter({
  category: config.translation.category,
  windowMs: config.translation.windowMs,
  max: config.translation.max,
  message: config.translation.message,
});

// 5. AI Reasoning, Triage & Vision Analysis Limiter (Protects Gemini 3.8 & Gemma 4)
const aiReasoningLimiter = createRateLimiter({
  category: config.aiReasoning.category,
  windowMs: config.aiReasoning.windowMs,
  max: config.aiReasoning.max,
  message: config.aiReasoning.message,
});

// 6. Text-to-Speech Limiter (Protects TTS synthesis endpoints)
const ttsLimiter = createRateLimiter({
  category: config.tts.category,
  windowMs: config.tts.windowMs,
  max: config.tts.max,
  message: config.tts.message,
});

// 7. Emergency SOS & Offline Packet Sync Limiter (Safety-Critical Flood Protection)
const emergencyLimiter = createRateLimiter({
  category: config.emergency.category,
  windowMs: config.emergency.windowMs,
  max: config.emergency.max,
  message: config.emergency.message,
});

// 8. Health & Liveness Probe Limiter (Render / Deployment monitoring)
const healthLimiter = createRateLimiter({
  category: config.health.category,
  windowMs: config.health.windowMs,
  max: config.health.max,
  message: config.health.message,
  skip: () => process.env.NODE_ENV === 'development',
});

// Primary export and backward compatibility alias
module.exports = generalLimiter;
module.exports.generalLimiter = generalLimiter;
module.exports.authLimiter = authLimiter;
module.exports.voiceLimiter = voiceLimiter;
module.exports.translationLimiter = translationLimiter;
module.exports.aiReasoningLimiter = aiReasoningLimiter;
module.exports.ttsLimiter = ttsLimiter;
module.exports.emergencyLimiter = emergencyLimiter;
module.exports.healthLimiter = healthLimiter;
module.exports.createRateLimiter = createRateLimiter;
