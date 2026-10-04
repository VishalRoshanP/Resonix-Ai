const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const validate = require('../middlewares/validationMiddleware');
const { validateCreateReport, validateUpdateReport } = require('../validations/reportValidation');
const { authorizeResponder } = require('../middlewares/authMiddleware');
const {
  emergencyLimiter,
  aiReasoningLimiter,
} = require('../middlewares/rateLimitMiddleware');

const incidentFusionController = require('../controllers/incidentFusionController');

router.get('/', reportController.getReports);
router.get('/clusters', incidentFusionController.getIncidentFusionClusters);
router.post('/cluster', incidentFusionController.clusterReports);
router.post('/cluster-reports', incidentFusionController.clusterReports);
router.get('/:id', reportController.getReportById);
router.post('/', emergencyLimiter, validate(validateCreateReport), reportController.createReport);
router.post('/upload', emergencyLimiter, reportController.uploadReportPhoto);
router.post('/location', emergencyLimiter, reportController.saveReportLocation);
router.post('/analyze-text', aiReasoningLimiter, reportController.analyzeTextReport);
router.post('/triage', aiReasoningLimiter, reportController.triageReportPayload);
router.post('/:id/triage', aiReasoningLimiter, reportController.triageReportById);
router.post('/pipeline', emergencyLimiter, reportController.executeUnifiedPipeline);
router.put('/:id', validate(validateUpdateReport), reportController.updateReport);
router.delete('/:id', authorizeResponder, reportController.deleteReport);

module.exports = router;

