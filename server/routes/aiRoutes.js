const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const authMiddleware = require('../middlewares/authMiddleware');

// Public & Citizen Endpoints
router.post('/analyze', aiController.analyzeEmergency);
router.post('/gemma-language', aiController.processGemmaLanguageIntelligence);
router.get('/report/:id', aiController.getReportIntelligence);
router.get('/summary/:id', aiController.getReportSummary);
router.get('/explanation/:id', aiController.getReportExplanation);

module.exports = router;
