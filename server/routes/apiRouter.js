const express = require('express');
const router = express.Router();

const healthController = require('../controllers/healthController');
const healthRoutes = require('./healthRoutes');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const reportRoutes = require('./reportRoutes');
const incidentRoutes = require('./incidentRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const relayRoutes = require('./relayRoutes');
const settingsRoutes = require('./settingsRoutes');
const analyticsRoutes = require('./analyticsRoutes');
const resourceRoutes = require('./resourceRoutes');
const voiceRoutes = require('./voiceRoutes');
const emergencyRoutes = require('./emergencyRoutes');
const aiRoutes = require('./aiRoutes');
const offlineRoutes = require('./offlineRoutes');
const incidentFusionRoutes = require('./incidentFusionRoutes');
const weatherRoutes = require('./weatherRoutes');

const personnelRoutes = require('./personnelRoutes');
const logisticsRoutes = require('./logisticsRoutes');
const feedbackRoutes = require('./feedbackRoutes');

const { healthLimiter } = require('../middlewares/rateLimitMiddleware');

// Direct Health & Status Routes
router.get('/health', healthLimiter, healthController.getHealth);
router.get('/version', healthLimiter, healthController.getVersion);
router.get('/status', healthLimiter, healthController.getStatus);

// Router Module Mounts
router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/reports', reportRoutes);
router.use('/incidents', incidentRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/relay', relayRoutes);
router.use('/offline', offlineRoutes);
router.use('/settings', settingsRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/resources', resourceRoutes);
router.use('/voice', voiceRoutes);
router.use('/emergency', emergencyRoutes);
router.use('/ai', aiRoutes);
router.use('/fusion', incidentFusionRoutes);
router.use('/incident-fusion', incidentFusionRoutes);
router.use('/weather', weatherRoutes);

// Preserved Domain Routes
router.use('/personnel', personnelRoutes);
router.use('/logistics', logisticsRoutes);
router.use('/feedback', feedbackRoutes);

module.exports = router;
