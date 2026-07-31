const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const validate = require('../middlewares/validationMiddleware');
const { validateCreateReport, validateUpdateReport } = require('../validations/reportValidation');

router.get('/', reportController.getReports);
router.get('/:id', reportController.getReportById);
router.post('/', validate(validateCreateReport), reportController.createReport);
router.post('/upload', reportController.uploadReportPhoto);
router.post('/location', reportController.saveReportLocation);
router.post('/analyze-text', reportController.analyzeTextReport);
router.post('/pipeline', reportController.executeUnifiedPipeline);
router.put('/:id', validate(validateUpdateReport), reportController.updateReport);
router.delete('/:id', reportController.deleteReport);

module.exports = router;
