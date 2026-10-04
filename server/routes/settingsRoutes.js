const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const validate = require('../middlewares/validationMiddleware');
const { authorizeResponder } = require('../middlewares/authMiddleware');
const { validateUpdateSettings } = require('../validations/settingsValidation');

router.get('/', settingsController.getSettings);
router.put('/', authorizeResponder, validate(validateUpdateSettings), settingsController.updateSettings);

module.exports = router;

