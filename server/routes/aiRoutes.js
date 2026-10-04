const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const authMiddleware = require('../middlewares/authMiddleware');
const { aiReasoningLimiter, voiceLimiter } = require('../middlewares/rateLimitMiddleware');

// Public & Citizen Endpoints
router.post('/analyze', aiReasoningLimiter, aiController.analyzeEmergency);
router.post('/transcribe', voiceLimiter, aiController.transcribeAudio);
router.post('/gemma-language', aiReasoningLimiter, aiController.processGemmaLanguageIntelligence);
router.get('/report/:id', aiController.getReportIntelligence);
router.get('/summary/:id', aiController.getReportSummary);
router.get('/explanation/:id', aiController.getReportExplanation);

module.exports = router;
