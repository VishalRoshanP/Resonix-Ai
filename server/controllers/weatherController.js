/**
 * Weather Controller
 * 
 * Handles HTTP requests for real meteorological data, forecasts, alerts, and geocoding.
 */

const weatherService = require('../services/weather/weatherService');
const ApiResponse = require('../utils/apiResponse');

/**
 * @route   GET /api/v1/weather/current
 * @desc    Get current real meteorological conditions
 * @access  Public
 */
const getCurrent = async (req, res, next) => {
  try {
    const { lat, lon } = req.validatedCoordinates;
    const result = await weatherService.getCurrentWeather(lat, lon, {
      locationName: req.query.locationName,
      bypassCache: req.query.fresh === 'true',
    });
    return ApiResponse.success(res, 200, 'Current weather conditions retrieved successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/weather/forecast/hourly
 * @desc    Get 24-hour hourly meteorological forecast
 * @access  Public
 */
const getHourly = async (req, res, next) => {
  try {
    const { lat, lon } = req.validatedCoordinates;
    const result = await weatherService.getHourlyForecast(lat, lon, {
      locationName: req.query.locationName,
      bypassCache: req.query.fresh === 'true',
    });
    return ApiResponse.success(res, 200, 'Hourly weather forecast retrieved successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/weather/forecast/daily
 * @desc    Get 7-day daily meteorological forecast
 * @access  Public
 */
const getDaily = async (req, res, next) => {
  try {
    const { lat, lon } = req.validatedCoordinates;
    const result = await weatherService.getDailyForecast(lat, lon, {
      locationName: req.query.locationName,
      bypassCache: req.query.fresh === 'true',
    });
    return ApiResponse.success(res, 200, 'Daily weather forecast retrieved successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/weather/warnings
 * @desc    Get severe meteorological warnings and disaster threshold alerts
 * @access  Public
 */
const getWarnings = async (req, res, next) => {
  try {
    const { lat, lon } = req.validatedCoordinates;
    const result = await weatherService.getWeatherWarnings(lat, lon, {
      locationName: req.query.locationName,
      bypassCache: req.query.fresh === 'true',
    });
    return ApiResponse.success(res, 200, 'Weather warnings and alerts retrieved successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/weather/comprehensive
 * @desc    Get complete weather bundle (current, hourly, daily, warnings, source attribution)
 * @access  Public
 */
const getComprehensive = async (req, res, next) => {
  try {
    const { lat, lon } = req.validatedCoordinates;
    const result = await weatherService.getComprehensiveWeather(lat, lon, {
      locationName: req.query.locationName,
      bypassCache: req.query.fresh === 'true',
    });
    return ApiResponse.success(res, 200, 'Comprehensive weather data retrieved successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/weather/lookup
 * @desc    Search geographical locations by name or query
 * @access  Public
 */
const lookupLocation = async (req, res, next) => {
  try {
    const query = req.validatedQuery;
    const rawResults = await weatherService.searchLocation(query);
    const locations = Array.isArray(rawResults)
      ? rawResults
      : (typeof rawResults === 'object' && rawResults !== null
          ? Object.values(rawResults).filter(item => item && typeof item === 'object' && item.name && typeof item.latitude === 'number')
          : []);
    return ApiResponse.success(res, 200, `Found ${locations.length} matching location(s)`, { locations });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/weather/reverse-lookup
 * @desc    Reverse geocode coordinates to human-readable locality/city name
 * @access  Public
 */
const reverseLookup = async (req, res, next) => {
  try {
    const { lat, lon } = req.validatedCoordinates;
    const result = await weatherService.reverseGeocode(lat, lon);
    return ApiResponse.success(res, 200, 'Reverse geocode location resolved successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/weather/ask
 * @desc    Conversational Weather Intelligence assistant ("weather near me", "will it rain here tomorrow?")
 * @access  Public
 */
const askWeather = async (req, res, next) => {
  try {
    const { query, lat, lon, locationName, city, state, country, language } = req.validatedAsk;
    const result = await weatherService.askWeather(query, lat, lon, { locationName, city, state, country, language });
    return ApiResponse.success(res, 200, 'Weather intelligence query answered successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/weather/worker/status
 * @desc    Get background weather ingestion worker telemetry
 * @access  Public
 */
const getWorkerStatus = (req, res, next) => {
  try {
    const weatherIngestionWorker = require('../services/weather/weatherIngestionWorker');
    const status = weatherIngestionWorker.getStatus();
    return ApiResponse.success(res, 200, 'Weather ingestion worker telemetry retrieved successfully', status);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/weather/worker/refresh
 * @desc    Trigger an on-demand weather ingestion cycle
 * @access  Public
 */
const triggerWorkerRefresh = async (req, res, next) => {
  try {
    const weatherIngestionWorker = require('../services/weather/weatherIngestionWorker');
    const result = await weatherIngestionWorker.runIngestionCycle();
    return ApiResponse.success(res, 200, 'Weather ingestion cycle executed successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/weather/historical
 * @desc    Get historical meteorological observations and precipitation sum
 * @access  Public
 */
const getHistoricalWeather = async (req, res, next) => {
  try {
    const weatherHistoricalService = require('../services/weather/weatherHistoricalService');
    const { lat, lon } = req.validatedCoordinates;
    const year = req.query.year ? parseInt(req.query.year, 10) : undefined;
    const result = await weatherHistoricalService.getHistoricalWeather(lat, lon, { year });
    return ApiResponse.success(res, 200, 'Historical meteorological data retrieved successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/weather/climate-trends
 * @desc    Get multi-year climate trends and precipitation shifts
 * @access  Public
 */
const getClimateTrends = async (req, res, next) => {
  try {
    const weatherHistoricalService = require('../services/weather/weatherHistoricalService');
    const { lat, lon } = req.validatedCoordinates;
    const years = req.query.years
      ? req.query.years.split(',').map((y) => parseInt(y.trim(), 10)).filter((y) => !isNaN(y))
      : undefined;
    const yearsCount = req.query.yearsCount
      ? parseInt(req.query.yearsCount, 10)
      : (req.query.count ? parseInt(req.query.count, 10) : 5);
    const result = await weatherHistoricalService.getClimateTrends(lat, lon, { years, yearsCount });
    return ApiResponse.success(res, 200, 'Climate trend analytics retrieved successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/weather/historical/monthly
 * @desc    Get 12-month historical temperature and precipitation profile for visualization
 * @access  Public
 */
const getMonthlyHistorical = async (req, res, next) => {
  try {
    const weatherHistoricalService = require('../services/weather/weatherHistoricalService');
    const { lat, lon } = req.validatedCoordinates;
    const year = req.query.year ? parseInt(req.query.year, 10) : undefined;
    const result = await weatherHistoricalService.getHistoricalWeather(lat, lon, { year });
    return ApiResponse.success(res, 200, 'Monthly historical meteorological profile retrieved successfully', {
      latitude: result.latitude,
      longitude: result.longitude,
      year: result.year,
      monthlyBreakdown: result.monthlyBreakdown,
      hottestMonth: result.hottestMonth,
      wettestMonth: result.wettestMonth,
      coldestMonth: result.coldestMonth,
      extremeEvents: result.extremeEvents,
      totalRainfallMm: result.totalRainfallMm,
      source: result.source,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/weather/voice/query
 * @desc    Process Indian-language voice weather query (STT -> Intent -> Grounded AI -> TTS)
 * @access  Public
 */
const processVoiceQuery = async (req, res, next) => {
  try {
    const weatherVoiceService = require('../services/weather/weatherVoiceService');
    const {
      audioData,
      dataUrl,
      buffer,
      mimeType,
      transcript,
      languageHint,
      latitude,
      longitude,
      locationName,
      voice,
    } = req.body || {};

    const lat = latitude != null ? parseFloat(latitude) : (req.validatedCoordinates?.lat || null);
    const lon = longitude != null ? parseFloat(longitude) : (req.validatedCoordinates?.lon || null);

    const result = await weatherVoiceService.processVoiceQuery({
      audioData,
      dataUrl,
      buffer,
      mimeType,
      transcript,
      languageHint,
      latitude: lat,
      longitude: lon,
      locationName,
      voice,
    });

    return ApiResponse.success(res, 200, 'Voice weather query processed successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/weather/nwp/forecast
 * @desc    Get Numerical Weather Prediction (NWP) model forecast (GFS, ECMWF, WRF)
 * @access  Public
 */
const getNwpForecast = async (req, res, next) => {
  try {
    const { lat, lon } = req.validatedCoordinates;
    const model = req.query.model || 'gfs';
    const days = req.query.days ? parseInt(req.query.days, 10) : 7;
    const result = await weatherService.getNwpForecast(lat, lon, {
      model,
      days,
      locationName: req.query.locationName,
      bypassCache: req.query.fresh === 'true',
    });
    return ApiResponse.success(res, 200, `NWP forecast (${model.toUpperCase()}) retrieved successfully`, result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/weather/nwp/compare
 * @desc    Compare NWP models (GFS, ECMWF, WRF) with ensemble consensus and spread
 * @access  Public
 */
const getNwpComparison = async (req, res, next) => {
  try {
    const { lat, lon } = req.validatedCoordinates;
    const days = req.query.days ? parseInt(req.query.days, 10) : 3;
    const result = await weatherService.getNwpModelComparison(lat, lon, {
      days,
      locationName: req.query.locationName,
      bypassCache: req.query.fresh === 'true',
    });
    return ApiResponse.success(res, 200, 'NWP multi-model comparison retrieved successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/weather/nwp/models
 * @desc    List available NWP models with documented metadata
 * @access  Public
 */
const getAvailableNwpModels = (req, res, next) => {
  try {
    const models = weatherService.getAvailableNwpModels();
    return ApiResponse.success(res, 200, 'Available NWP models retrieved successfully', { models });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/weather/risk
 * @desc    Get Resonix Local Weather Risk Assessment (decision-support layer)
 * @access  Public
 */
const getLocalWeatherRisk = async (req, res, next) => {
  try {
    const { lat, lon } = req.validatedCoordinates;
    const result = await weatherService.getLocalWeatherRisk(lat, lon, {
      radiusKm: req.query.radiusKm,
      locationName: req.query.locationName,
      bypassCache: req.query.fresh === 'true',
    });
    return ApiResponse.success(res, 200, 'Local weather risk assessment retrieved successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/weather/situation
 * @route   GET /api/v1/weather/forecast-ground-truth
 * @desc    Get Resonix Forecast + Ground Truth Unified Situation View
 * @access  Public / Private (Command Center)
 */
const getUnifiedSituationView = async (req, res, next) => {
  try {
    const { lat, lon } = req.validatedCoordinates;
    const forecastGroundTruthService = require('../services/weather/forecastGroundTruthService');
    const result = await forecastGroundTruthService.getUnifiedSituationView(lat, lon, {
      radiusKm: req.query.radiusKm,
      locationName: req.query.locationName,
      bypassCache: req.query.fresh === 'true',
    });
    return ApiResponse.success(res, 200, 'Forecast + Ground Truth situation view retrieved successfully', result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCurrent,
  getHourly,
  getDaily,
  getWarnings,
  getComprehensive,
  lookupLocation,
  reverseLookup,
  askWeather,
  getWorkerStatus,
  triggerWorkerRefresh,
  getHistoricalWeather,
  getClimateTrends,
  getMonthlyHistorical,
  processVoiceQuery,
  getNwpForecast,
  getNwpComparison,
  getAvailableNwpModels,
  getLocalWeatherRisk,
  getUnifiedSituationView,
};


