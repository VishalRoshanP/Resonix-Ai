const express = require('express');
const router = express.Router();
const emergencyController = require('../controllers/emergencyController');
const validate = require('../middlewares/validationMiddleware');
const { validateCreateEmergency, validateLocation } = require('../validations/emergencyValidation');
const { authenticateUser } = require('../middlewares/authMiddleware');

/**
 * Citizen Emergency System Routes
 * Public / Guest accessible endpoints for emergency dispatches, with optional auth enrichment
 */

// POST /api/emergency/create - Create and store Emergency Packet in MongoDB
router.post('/create', validate(validateCreateEmergency), emergencyController.createEmergencyPacket);

// POST /api/emergency/sync - Batch synchronize offline emergency packets
router.post('/sync', emergencyController.syncOfflinePackets);

// POST /api/emergency/upload-photo - Upload and attach photo reference
router.post('/upload-photo', emergencyController.uploadPhoto);

// POST /api/emergency/analyze-vision - Gemma 4 e4b Vision Image Analysis
router.post('/analyze-vision', emergencyController.analyzeVision);

// POST /api/emergency/location - Update GPS coordinates and accuracy metrics
router.post('/location', validate(validateLocation), emergencyController.updateLocation);

// POST /api/emergency/audio - Upload and attach voice recording audio reference
router.post('/audio', emergencyController.uploadAudio);

// GET /api/emergency/status/:id - Retrieve emergency packet status by ID
router.get('/status/:id', emergencyController.getEmergencyStatus);

module.exports = router;
