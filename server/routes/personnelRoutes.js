const express = require('express');
const router = express.Router();
const personnelController = require('../controllers/personnelController');
const { protect, restrictTo } = require('../middlewares/authMiddleware');

router.get('/', protect, personnelController.getPersonnel);
router.get('/:id', protect, personnelController.getPersonnelById);
router.patch('/:id/biometrics', protect, restrictTo('commander', 'admin'), personnelController.updateBiometrics);

module.exports = router;
