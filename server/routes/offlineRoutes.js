const express = require('express');
const router = express.Router();
const emergencyController = require('../controllers/emergencyController');

router.post('/sync', emergencyController.syncOfflineQueue);

module.exports = router;
