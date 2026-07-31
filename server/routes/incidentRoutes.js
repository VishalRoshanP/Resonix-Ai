const express = require('express');
const router = express.Router();
const incidentController = require('../controllers/incidentController');
const validate = require('../middlewares/validationMiddleware');
const { validateCreateIncident, validateUpdateIncident } = require('../validations/incidentValidation');

router.get('/', incidentController.getIncidents);
router.delete('/history', incidentController.clearHistory);
router.delete('/completed', incidentController.clearHistory);
router.get('/:id', incidentController.getIncidentById);
router.post('/', validate(validateCreateIncident), incidentController.createIncident);
router.put('/:id', validate(validateUpdateIncident), incidentController.updateIncident);
router.delete('/:id', incidentController.deleteIncident);

module.exports = router;
