/**
 * Weather Express Routes
 * 
 * Mounts endpoints on /api/v1/weather/*
 */

const express = require('express');
const router = express.Router();
const weatherController = require('../controllers/weatherController');
const {
  validateCoordinateParams,
  validateLookupParams,
  validateAskParams,
} = require('../validations/weatherValidation');
const {
  aiReasoningLimiter,
  voiceLimiter,
} = require('../middlewares/rateLimitMiddleware');

router.get('/current', validateCoordinateParams, weatherController.getCurrent);
router.get('/forecast/hourly', validateCoordinateParams, weatherController.getHourly);
router.get('/forecast/daily', validateCoordinateParams, weatherController.getDaily);
router.get('/warnings', validateCoordinateParams, weatherController.getWarnings);
router.get('/comprehensive', validateCoordinateParams, weatherController.getComprehensive);
router.get('/lookup', validateLookupParams, weatherController.lookupLocation);
router.get('/reverse-lookup', validateCoordinateParams, weatherController.reverseLookup);

// Conversational Weather Intelligence Assistant (WeatherGPT Grounded Agent with AI rate limiting)
router.post('/ask', aiReasoningLimiter, validateAskParams, weatherController.askWeather);
router.get('/ask', aiReasoningLimiter, validateAskParams, weatherController.askWeather);
router.post('/agent/query', aiReasoningLimiter, validateAskParams, weatherController.askWeather);
router.get('/agent/query', aiReasoningLimiter, validateAskParams, weatherController.askWeather);

// Indian-Language Voice Weather Interaction (Protected by Voice Quota Limiter)
router.post('/voice/query', voiceLimiter, weatherController.processVoiceQuery);

// Historical Weather Observations & Multi-Year Climate Trends
router.get('/historical', validateCoordinateParams, weatherController.getHistoricalWeather);
router.get('/historical/monthly', validateCoordinateParams, weatherController.getMonthlyHistorical);
router.get('/climate-trends', validateCoordinateParams, weatherController.getClimateTrends);

// Numerical Weather Prediction (NWP) Models (GFS, ECMWF, WRF)
router.get('/nwp/forecast', validateCoordinateParams, weatherController.getNwpForecast);
router.get('/nwp/compare', validateCoordinateParams, weatherController.getNwpComparison);
router.get('/nwp/models', weatherController.getAvailableNwpModels);

// Resonix Local Weather Risk Assessment (Decision-Support Layer)
router.get('/risk', validateCoordinateParams, weatherController.getLocalWeatherRisk);

// Resonix Forecast + Ground Truth Unified Situation View
router.get('/situation', validateCoordinateParams, weatherController.getUnifiedSituationView);
router.get('/forecast-ground-truth', validateCoordinateParams, weatherController.getUnifiedSituationView);

// Extreme Weather Alert Engine Endpoints
const weatherAlertController = require('../controllers/weatherAlertController');
router.get('/alerts/active', weatherAlertController.getActiveAlerts);
router.get('/alerts/latest', weatherAlertController.getLatestWarning);
router.get('/alerts/history', weatherAlertController.getAlertHistory);
router.post('/alerts/ingest', weatherAlertController.ingestAlert);
router.post('/alerts/explain', aiReasoningLimiter, weatherAlertController.explainAlert);

// Background Worker Management & Telemetry
router.get('/worker/status', weatherController.getWorkerStatus);
router.post('/worker/refresh', weatherController.triggerWorkerRefresh);

module.exports = router;
