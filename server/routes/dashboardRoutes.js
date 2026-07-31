const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const validate = require('../middlewares/validationMiddleware');
const { validateDashboardQuery } = require('../validations/dashboardValidation');

router.get('/stats', validate(validateDashboardQuery), dashboardController.getDashboardStats);
router.get('/activity', dashboardController.getDashboardActivity);

module.exports = router;
