/**
 * RESONIX AI — Centralized Server-Side Rate Limiting Configuration
 * 
 * Defines production-safe rate limiting thresholds, windows, and proxy awareness.
 * Protects external AI/STT quotas (Gemini, Sarvam, Gemma) and core database resources
 * from abuse, while strictly preserving emergency reporting, offline packet sync,
 * and deployment health checks.
 * 
 * Deployment Note:
 * This configuration utilizes an in-memory per-process rate-limiting store.
 * For single-instance Render deployments, this requires zero additional infrastructure.
 * If scaling to a horizontally distributed multi-instance deployment in the future,
 * an external shared cache (such as Redis) can be plugged in via express-rate-limit store.
 */

const isProd = process.env.NODE_ENV === 'production';

const rateLimitConfig = {
  // Global switch to enable/disable rate limiting (e.g., during automated test runs)
  enabled: process.env.RATE_LIMIT_ENABLED !== 'false',

  // Trust proxy configuration for Render / reverse proxies (1 = first upstream proxy)
  trustProxy: process.env.TRUST_PROXY
    ? (isNaN(process.env.TRUST_PROXY) ? process.env.TRUST_PROXY : parseInt(process.env.TRUST_PROXY, 10))
    : 1,

  // Standard rate limit headers (RFC draft-7: RateLimit-Policy, RateLimit-Limit, etc.)
  standardHeaders: 'draft-7',
  legacyHeaders: false,

  // 1. General API Gateway Limiter (All /api endpoints)
  general: {
    category: 'GENERAL_API',
    windowMs: parseInt(process.env.RATE_LIMIT_API_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_API_MAX, 10) || (isProd ? 1000 : 5000),
    message: 'Too many requests to the Resonix API. Please try again later.',
  },

  // 2. Authentication & Credential Protection (Brute-Force Guard for Login/Register)
  auth: {
    category: 'AUTHENTICATION',
    windowMs: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_AUTH_MAX, 10) || (isProd ? 15 : 100),
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
  },

  // 3. Voice & Speech-to-Text (Protects Gemini 3.5 Transcribe & Sarvam Saaras:v4 STT quota)
  voice: {
    category: 'VOICE_STT',
    windowMs: parseInt(process.env.RATE_LIMIT_VOICE_WINDOW_MS, 10) || 60 * 1000, // 1 minute
    max: parseInt(process.env.RATE_LIMIT_VOICE_MAX, 10) || (isProd ? 20 : 60),
    message: 'Voice transcription request quota exceeded. Please wait a moment before sending more audio.',
  },

  // 4. Multilingual Translation (Protects Gemini & Sarvam translation endpoints)
  translation: {
    category: 'TRANSLATION',
    windowMs: parseInt(process.env.RATE_LIMIT_TRANSLATE_WINDOW_MS, 10) || 60 * 1000, // 1 minute
    max: parseInt(process.env.RATE_LIMIT_TRANSLATE_MAX, 10) || (isProd ? 30 : 90),
    message: 'Translation request limit exceeded. Please wait a moment before trying again.',
  },

  // 5. AI Reasoning, Triage & Vision Analysis (Protects Gemini 3.8 Flash & Gemma 4 quota)
  aiReasoning: {
    category: 'AI_REASONING',
    windowMs: parseInt(process.env.RATE_LIMIT_AI_WINDOW_MS, 10) || 60 * 1000, // 1 minute
    max: parseInt(process.env.RATE_LIMIT_AI_MAX, 10) || (isProd ? 30 : 90),
    message: 'AI reasoning and analysis request limit exceeded. Please wait a moment.',
  },

  // 6. Text-to-Speech (Protects TTS synthesis endpoints)
  tts: {
    category: 'TTS_SYNTHESIS',
    windowMs: parseInt(process.env.RATE_LIMIT_TTS_WINDOW_MS, 10) || 60 * 1000, // 1 minute
    max: parseInt(process.env.RATE_LIMIT_TTS_MAX, 10) || (isProd ? 20 : 60),
    message: 'Speech synthesis request limit exceeded. Please wait a moment.',
  },

  // 7. Emergency SOS & Offline Packet Sync (Safety Critical: high burst tolerance to never block legitimate distress)
  emergency: {
    category: 'EMERGENCY_SOS',
    windowMs: parseInt(process.env.RATE_LIMIT_EMERGENCY_WINDOW_MS, 10) || 60 * 1000, // 1 minute
    max: parseInt(process.env.RATE_LIMIT_EMERGENCY_MAX, 10) || (isProd ? 60 : 180),
    message: 'Emergency request frequency is unusually high. System is safeguarding telemetry channels.',
  },

  // 8. Health & Monitoring Probes (Render / Deployment Liveness - High throughput / bypass)
  health: {
    category: 'HEALTH_PROBE',
    windowMs: parseInt(process.env.RATE_LIMIT_HEALTH_WINDOW_MS, 10) || 60 * 1000, // 1 minute
    max: parseInt(process.env.RATE_LIMIT_HEALTH_MAX, 10) || (isProd ? 1200 : 5000),
    message: 'Health probe limit exceeded.',
  },
};

module.exports = rateLimitConfig;
