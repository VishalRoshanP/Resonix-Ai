/**
 * Weather Alert Controller
 * 
 * Exposes endpoints for active alerts, cached latest warnings, alert history,
 * warning feed ingestion, and Gemini guided plain-language explanations.
 */

const extremeWeatherAlertEngine = require('../services/weather/extremeWeatherAlertEngine');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');

/**
 * @route   GET /api/v1/weather/alerts/active
 * @desc    Get active extreme weather alerts affecting citizen coordinates
 * @access  Public
 */
const getActiveAlerts = async (req, res, next) => {
  try {
    const lat = req.query.lat ? parseFloat(req.query.lat) : null;
    const lon = req.query.lon ? parseFloat(req.query.lon) : null;

    const alerts = extremeWeatherAlertEngine.getActiveAlerts(lat, lon);
    return ApiResponse.success(res, 200, `Retrieved ${alerts.length} active weather alert(s)`, {
      count: alerts.length,
      alerts,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/weather/alerts/latest
 * @desc    Get latest cached active warning for citizen coordinates
 * @access  Public
 */
const getLatestWarning = async (req, res, next) => {
  try {
    const lat = req.query.lat ? parseFloat(req.query.lat) : null;
    const lon = req.query.lon ? parseFloat(req.query.lon) : null;

    const latest = extremeWeatherAlertEngine.getLatestWarning(lat, lon);
    if (!latest) {
      return ApiResponse.success(res, 200, 'No active extreme weather warnings currently affecting this area.', {
        hasActiveWarning: false,
        warning: null,
      });
    }

    return ApiResponse.success(res, 200, 'Latest active weather alert retrieved successfully', {
      hasActiveWarning: true,
      warning: latest,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/weather/alerts/history
 * @desc    Get alert history (active, updated, expired, cancelled)
 * @access  Public
 */
const getAlertHistory = async (req, res, next) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
    const alertType = req.query.alertType;
    const status = req.query.status;

    const history = extremeWeatherAlertEngine.getAlertHistory({ limit, alertType, status });
    return ApiResponse.success(res, 200, `Retrieved ${history.length} historical alert records`, {
      count: history.length,
      history,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/weather/alerts/ingest
 * @desc    Ingest real-time official warning feed payload
 * @access  Public / Internal API
 */
const ingestAlert = async (req, res, next) => {
  try {
    const feedPayload = req.body;
    if (!feedPayload) {
      throw new ApiError(400, 'Warning feed payload is required in request body.');
    }

    const outcome = await extremeWeatherAlertEngine.processWarningFeed(feedPayload, {
      source: req.body.source || 'Direct Warning Feed Ingestion API',
    });

    return ApiResponse.success(res, 201, 'Warning feed processed successfully', outcome);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/weather/alerts/explain
 * @desc    Gemini plain-language explanation of a retrieved official warning
 *          STRICT: Never allows Gemini to create an official warning independently.
 * @access  Public
 */
const explainAlert = async (req, res, next) => {
  try {
    const { alert, alertId } = req.body;
    let targetAlert = alert;

    if (!targetAlert && alertId) {
      targetAlert = extremeWeatherAlertEngine.activeAlerts.get(alertId);
    }

    if (!targetAlert) {
      throw new ApiError(400, 'A valid retrieved alert or active alertId is required for explanation.');
    }

    const result = await extremeWeatherAlertEngine.explainWarningWithGemini(targetAlert, req.body.language || 'en');
    return ApiResponse.success(res, 200, 'Alert explained successfully', result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getActiveAlerts,
  getLatestWarning,
  getAlertHistory,
  ingestAlert,
  explainAlert,
};
