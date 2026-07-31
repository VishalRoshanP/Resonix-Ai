const express = require('express');
const router = express.Router();
const relayController = require('../controllers/relayController');
const validate = require('../middlewares/validationMiddleware');
const { validateCreateRelayNode, validateUpdateRelayNode } = require('../validations/relayValidation');

const emergencyController = require('../controllers/emergencyController');

router.get('/', relayController.getRelayNodes);
router.get('/status', emergencyController.getRelayStatus);
router.get('/analytics', relayController.getRelayAnalytics);
router.get('/analytics/:id', relayController.getRelayAnalyticsById);
router.get('/:id', relayController.getRelayNodeById);
router.post('/', validate(validateCreateRelayNode), relayController.createRelayNode);
router.post('/packet', relayController.receiveEmergencyPacket);
router.post('/upload', emergencyController.uploadRelayPacket);
router.put('/:id', validate(validateUpdateRelayNode), relayController.updateRelayNode);
router.delete('/:id', relayController.deleteRelayNode);

module.exports = router;
