const express = require('express');
const router = express.Router();
const incidentController = require('../controllers/incidentController');
const incidentFusionController = require('../controllers/incidentFusionController');
const validate = require('../middlewares/validationMiddleware');
const { validateCreateIncident, validateUpdateIncident } = require('../validations/incidentValidation');
const { authorizeResponder } = require('../middlewares/authMiddleware');

router.get('/', incidentController.getIncidents);
router.get('/dashboard-summary', incidentController.getDashboardSummary);
router.get('/fusion', incidentFusionController.getIncidentFusionClusters);
router.get('/fusion/clusters', incidentFusionController.getIncidentFusionClusters);
router.post('/cluster-reports', incidentFusionController.clusterReports);
router.post('/fusion/cluster-reports', incidentFusionController.clusterReports);
router.delete('/history', authorizeResponder, incidentController.clearHistory);
router.delete('/completed', authorizeResponder, incidentController.clearHistory);
router.get('/:id', incidentController.getIncidentById);
router.post('/', validate(validateCreateIncident), incidentController.createIncident);
router.put('/:id/acknowledge', authorizeResponder, incidentController.acknowledgeIncident);
router.post('/:id/acknowledge', authorizeResponder, incidentController.acknowledgeIncident);
router.put('/:id', validate(validateUpdateIncident), incidentController.updateIncident);
router.delete('/:id', authorizeResponder, incidentController.deleteIncident);

module.exports = router;

