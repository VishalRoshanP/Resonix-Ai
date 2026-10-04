const express = require('express');
const router = express.Router();
const healthController = require('../controllers/healthController');
const { healthLimiter } = require('../middlewares/rateLimitMiddleware');

router.get('/health', healthLimiter, healthController.getHealth);
router.get('/version', healthLimiter, healthController.getVersion);
router.get('/status', healthLimiter, healthController.getStatus);

module.exports = router;
