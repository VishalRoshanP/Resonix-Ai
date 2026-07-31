const express = require('express');
const router = express.Router();
const healthController = require('../controllers/healthController');

router.get('/health', healthController.getHealth);
router.get('/version', healthController.getVersion);
router.get('/status', healthController.getStatus);

module.exports = router;
