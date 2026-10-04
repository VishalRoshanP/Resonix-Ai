const express = require('express');
const router = express.Router();
const incidentFusionController = require('../controllers/incidentFusionController');

// GET /api/v1/fusion/clusters or /api/v1/incident-fusion/clusters
router.get('/', incidentFusionController.getIncidentFusionClusters);
router.get('/clusters', incidentFusionController.getIncidentFusionClusters);

// POST /api/v1/fusion/cluster-reports (On-demand geographic & time-based clustering)
router.post('/cluster-reports', incidentFusionController.clusterReports);
router.post('/clusters/reports', incidentFusionController.clusterReports);

module.exports = router;
