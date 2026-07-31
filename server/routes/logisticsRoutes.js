const express = require('express');
const router = express.Router();
const logisticsController = require('../controllers/logisticsController');
const { protect, restrictTo } = require('../middlewares/authMiddleware');

router.get('/', protect, logisticsController.getLogistics);
router.post('/dispatch', protect, restrictTo('commander', 'admin'), logisticsController.createDispatch);

module.exports = router;
