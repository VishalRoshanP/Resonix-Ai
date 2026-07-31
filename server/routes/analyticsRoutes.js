const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const validate = require('../middlewares/validationMiddleware');
const { validateAnalyticsQuery } = require('../validations/analyticsValidation');

router.get('/', validate(validateAnalyticsQuery), analyticsController.getAnalytics);

module.exports = router;
