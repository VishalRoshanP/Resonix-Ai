const express = require('express');
const router = express.Router();
const emergencyController = require('../controllers/emergencyController');
const validate = require('../middlewares/validationMiddleware');
const { validateCreateEmergency, validateLocation } = require('../validations/emergencyValidation');
const { authenticateUser } = require('../middlewares/authMiddleware');
const {
  emergencyLimiter,
  aiReasoningLimiter,
  translationLimiter,
  voiceLimiter,
} = require('../middlewares/rateLimitMiddleware');

/**
 * Citizen Emergency System Routes
 * Public / Guest accessible endpoints for emergency dispatches, with optional auth enrichment
 */

// POST /api/emergency/create - Create and store Emergency Packet in MongoDB
router.post('/create', emergencyLimiter, validate(validateCreateEmergency), emergencyController.createEmergencyPacket);

// POST /api/emergency/sync - Batch synchronize offline emergency packets
router.post('/sync', emergencyLimiter, emergencyController.syncOfflinePackets);

// POST /api/emergency/upload-photo - Upload and attach photo reference
router.post('/upload-photo', emergencyLimiter, emergencyController.uploadPhoto);

// POST /api/emergency/analyze-vision - Disaster Scene Vision Image Analysis
router.post('/analyze-vision', aiReasoningLimiter, emergencyController.analyzeVision);

// POST /api/emergency/location - Update GPS coordinates and accuracy metrics
router.post('/location', emergencyLimiter, validate(validateLocation), emergencyController.updateLocation);

// POST /api/emergency/detect-language - Content-driven AI language detection from transcript
router.post('/detect-language', translationLimiter, emergencyController.detectLanguage);

// POST /api/emergency/transcribe - Multilingual speech-to-text transcription via Gemini 3.5 Transcribe
router.post('/transcribe', voiceLimiter, emergencyController.transcribeAudio);

// GET /api/emergency/status/:id - Retrieve emergency packet status by ID
router.get('/status/:id', emergencyController.getEmergencyStatus);

// PATCH /api/emergency/:id - Asynchronous enrichment update (voice, photo, language, location)
router.patch('/:id', emergencyLimiter, emergencyController.updateEmergencyPacket);
router.put('/:id', emergencyLimiter, emergencyController.updateEmergencyPacket);

module.exports = router;
