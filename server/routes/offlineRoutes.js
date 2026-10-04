const express = require('express');
const router = express.Router();
const emergencyController = require('../controllers/emergencyController');
const { emergencyLimiter } = require('../middlewares/rateLimitMiddleware');

router.post('/sync', emergencyLimiter, emergencyController.syncOfflineQueue);

module.exports = router;
