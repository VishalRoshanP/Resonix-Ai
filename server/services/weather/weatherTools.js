/**
 * Weather Intelligence Function Calling Tools (SIH26068 WeatherGPT)
 * 
 * Implements the 8 required meteorological tools:
 * 1. get_current_weather
 * 2. get_hourly_forecast
 * 3. get_daily_forecast
 * 4. get_weather_alerts
 * 5. get_location_weather
 * 6. get_historical_weather
 * 7. get_climate_trends
 * 8. generate_weather_advisory
 * 
 * Auto-registers with Centralized Modular Tool Registry.
 */

const weatherService = require('./weatherService');
const weatherHistoricalService = require('./weatherHistoricalService');
const toolRegistry = require('../tools/toolRegistry');
const logger = require('../../utils/logger');

// ============================================================================
// TOOL IMPLEMENTATIONS
// ============================================================================

/**
 * Tool 1: get_current_weather
 */
async function getCurrentWeatherHandler(params = {}) {
  const lat = Number(params.latitude);
  const lon = Number(params.longitude);
  const data = await weatherService.getCurrentWeather(lat, lon, {
    locationName: params.locationName,
  });

  return {
    tool: 'get_current_weather',
    location: data.location,
    timestamp: data.timestamp,
    current: data.current,
    metadata: data.metadata,
  };
}

/**
 * Tool 2: get_hourly_forecast
 */
async function getHourlyForecastHandler(params = {}) {
  const lat = Number(params.latitude);
  const lon = Number(params.longitude);
  const hours = Number(params.hours) || 24;
  const data = await weatherService.getHourlyForecast(lat, lon, {
    locationName: params.locationName,
  });

  const slice = (data.hourlyForecast || []).slice(0, hours);
  return {
    tool: 'get_hourly_forecast',
    location: data.location,
    timestamp: data.timestamp,
    requestedHours: hours,
    hourlyForecast: slice,
    metadata: data.metadata,
  };
}

/**
 * Tool 3: get_daily_forecast
 */
async function getDailyForecastHandler(params = {}) {
  const lat = Number(params.latitude);
  const lon = Number(params.longitude);
  const days = Number(params.days) || 7;
  const data = await weatherService.getDailyForecast(lat, lon, {
    locationName: params.locationName,
  });

  const slice = (data.dailyForecast || []).slice(0, days);
  return {
    tool: 'get_daily_forecast',
    location: data.location,
    timestamp: data.timestamp,
    requestedDays: days,
    dailyForecast: slice,
    metadata: data.metadata,
  };
}

/**
 * Tool 4: get_weather_alerts
 */
async function getWeatherAlertsHandler(params = {}) {
  const lat = Number(params.latitude);
  const lon = Number(params.longitude);
  const data = await weatherService.getWeatherWarnings(lat, lon, {
    locationName: params.locationName,
  });

  return {
    tool: 'get_weather_alerts',
    location: data.location,
    timestamp: data.timestamp,
    threatLevel: data.threatLevel || (data.warnings?.length > 0 ? 'WARNING' : 'GREEN'),
    warningsCount: (data.warnings || []).length,
    warnings: data.warnings || [],
    currentSummary: data.currentSummary,
    metadata: data.metadata,
  };
}

/**
 * Tool 5: get_location_weather
 */
async function getLocationWeatherHandler(params = {}) {
  let targetLat = params.latitude != null ? Number(params.latitude) : null;
  let targetLon = params.longitude != null ? Number(params.longitude) : null;
  let resolvedLocationName = params.locationName;

  // If query string provided and coordinates absent, geocode query first
  if ((targetLat == null || targetLon == null) && params.query) {
    const candidates = await weatherService.searchLocation(params.query);
    if (!candidates || candidates.length === 0) {
      throw new Error(`Location '${params.query}' could not be resolved to geographical coordinates.`);
    }
    const top = candidates[0];
    targetLat = top.latitude;
    targetLon = top.longitude;
    resolvedLocationName = top.displayName || top.name;
  }

  if (targetLat == null || targetLon == null) {
    throw new Error('Either query string or valid latitude and longitude must be provided.');
  }

  const full = await weatherService.getComprehensiveWeather(targetLat, targetLon, {
    locationName: resolvedLocationName,
  });

  return {
    tool: 'get_location_weather',
    query: params.query,
    location: full.location,
    timestamp: full.timestamp,
    current: full.current,
    weather: {
      current: full.current,
      hourlyForecast: full.hourlyForecast || [],
      dailyForecast: full.dailyForecast || [],
    },
    hourlyForecast: (full.hourlyForecast || []).slice(0, 12),
    dailyForecast: full.dailyForecast || [],
    warnings: full.warnings || [],
    metadata: full.metadata,
  };
}

/**
 * Tool 6: get_historical_weather
 */
async function getHistoricalWeatherHandler(params = {}) {
  const lat = Number(params.latitude);
  const lon = Number(params.longitude);
  const data = await weatherHistoricalService.getHistoricalWeather(lat, lon, {
    year: params.year,
    startDate: params.startDate,
    endDate: params.endDate,
  });

  return {
    tool: 'get_historical_weather',
    ...data,
  };
}

/**
 * Tool 7: get_climate_trends
 */
async function getClimateTrendsHandler(params = {}) {
  const lat = Number(params.latitude);
  const lon = Number(params.longitude);
  const data = await weatherHistoricalService.getClimateTrends(lat, lon, {
    years: params.years,
    yearsCount: params.yearsCount,
  });

  return {
    tool: 'get_climate_trends',
    ...data,
  };
}

/**
 * Tool 8: generate_weather_advisory
 */
async function generateWeatherAdvisoryHandler(params = {}) {
  let weatherData = params.weatherData || {};
  let warnings = params.warnings || [];
  const userContext = params.userContext || {};

  // If weather data not supplied directly, fetch on-the-fly using coordinates
  if (!weatherData.current && (params.latitude != null || params.longitude != null)) {
    try {
      const fullWeather = await weatherService.getComprehensiveWeather(
        Number(params.latitude),
        Number(params.longitude),
        { locationName: params.locationName }
      );
      weatherData = fullWeather;
      if (!warnings || warnings.length === 0) {
        warnings = fullWeather.warnings || [];
      }
    } catch (err) {
      logger.warn(`[WeatherTools] generateWeatherAdvisoryHandler auto-fetch failed: ${err.message}`);
    }
  }

  const current = weatherData.current || {};
  const locationName = weatherData.location?.name || userContext.locationName || params.locationName || 'your area';

  const advisories = [];
  let urgency = 'NORMAL';

  // 1. Evaluate Warnings
  if (Array.isArray(warnings) && warnings.length > 0) {
    warnings.forEach((w) => {
      urgency = w.severity === 'EMERGENCY' || w.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH';
      advisories.push({
        type: 'SEVERE_WEATHER_ALERT',
        hazard: w.headline || w.event,
        severity: w.severity,
        recommendation: w.safetyRecommendation || 'Follow civil defense and meteorological guidance immediately.',
      });
    });
  }

  // 2. Evaluate Immediate Meteorological Hazards
  const wind = Number(current.windSpeed) || 0;
  const precip = Number(current.precipitation) || 0;
  const temp = Number(current.temperature);

  if (wind >= 50) {
    advisories.push({
      type: 'HIGH_WIND_ADVISORY',
      hazard: `Strong winds (${wind} km/h)`,
      severity: wind >= 75 ? 'CRITICAL' : 'HIGH',
      recommendation: 'Secure loose outdoor equipment, avoid parking under old trees, and stay clear of power lines.',
    });
  }

  if (precip >= 25) {
    advisories.push({
      type: 'HEAVY_RAINFALL_FLOOD_RISK',
      hazard: `Intense precipitation (${precip} mm)`,
      severity: 'HIGH',
      recommendation: 'Avoid low-lying underpasses and storm drains. Exercise extreme caution while driving.',
    });
  } else if (current.precipitationProbability >= 70) {
    advisories.push({
      type: 'RAIN_PRECAUTION',
      hazard: `High probability of rain (${current.precipitationProbability}%)`,
      severity: 'NORMAL',
      recommendation: 'Carry waterproof gear or umbrella; allow additional travel time.',
    });
  }

  if (temp >= 40) {
    advisories.push({
      type: 'HEAT_STRESS_ADVISORY',
      hazard: `Extreme heat (${temp}°C)`,
      severity: temp >= 44 ? 'CRITICAL' : 'HIGH',
      recommendation: 'Remain hydrated, avoid direct sun exposure between 12:00 and 15:00, and check on vulnerable individuals.',
    });
  } else if (temp <= 4 && temp != null) {
    advisories.push({
      type: 'COLD_EXPOSURE_ADVISORY',
      hazard: `Low ambient temperature (${temp}°C)`,
      severity: 'HIGH',
      recommendation: 'Wear insulated thermal layers, protect livestock and domestic animals from freezing drafts.',
    });
  }

  if (advisories.length === 0) {
    advisories.push({
      type: 'FAVORABLE_CONDITIONS',
      hazard: 'Normal atmospheric conditions',
      severity: 'NORMAL',
      recommendation: 'Weather is favorable for standard outdoor activities. No special safety precautions required.',
    });
  }

  return {
    tool: 'generate_weather_advisory',
    location: locationName,
    urgency,
    advisoriesCount: advisories.length,
    advisories,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Tool 9: get_nwp_forecast
 */
async function getNwpForecastHandler(params = {}) {
  const lat = Number(params.latitude);
  const lon = Number(params.longitude);
  const model = params.model || 'gfs';
  const days = Number(params.days) || 7;

  const data = await weatherService.getNwpForecast(lat, lon, {
    model,
    days,
    locationName: params.locationName,
  });

  return {
    tool: 'get_nwp_forecast',
    ...data,
  };
}

/**
 * Tool 10: compare_nwp_models
 */
async function compareNwpModelsHandler(params = {}) {
  const lat = Number(params.latitude);
  const lon = Number(params.longitude);
  const days = Number(params.days) || 3;

  const data = await weatherService.getNwpModelComparison(lat, lon, {
    days,
    locationName: params.locationName,
  });

  return {
    tool: 'compare_nwp_models',
    ...data,
  };
}

/**
 * Tool 11: get_local_weather_risk
 * Evaluates Resonix Local Weather Risk Assessment (Decision-Support Layer)
 * Across 7 factual signals with strict three-pillar separation.
 */
async function getLocalWeatherRiskHandler(params = {}) {
  const lat = Number(params.latitude);
  const lon = Number(params.longitude);
  const radiusKm = Number(params.radiusKm) || 25;

  const data = await weatherService.getLocalWeatherRisk(lat, lon, {
    radiusKm,
    locationName: params.locationName,
  });

  return {
    tool: 'get_local_weather_risk',
    ...data,
  };
}

/**
 * Tool 12: get_sector_advisory
 * Evaluates sector-specific meteorological decision support (farmer, aviation, marine)
 */
async function getSectorAdvisoryHandler(params = {}) {
  const lat = Number(params.latitude);
  const lon = Number(params.longitude);
  const sector = params.sector || null;

  const comprehensiveData = await weatherService.getComprehensiveWeather(lat, lon, { locationName: params.locationName });

  return {
    tool: 'get_sector_advisory',
    sector,
    location: comprehensiveData.location,
    timestamp: comprehensiveData.timestamp,
    current: comprehensiveData.current,
    dailyForecast: comprehensiveData.dailyForecast || [],
    warnings: comprehensiveData.warnings || [],
    metadata: comprehensiveData.metadata,
  };
}

// ============================================================================
// TOOL DEFINITIONS & REGISTRY BINDINGS
// ============================================================================

const WEATHER_TOOLS_DEFINITIONS = [
  {
    name: 'get_current_weather',
    description: 'Retrieves authoritative real-time meteorological observations (temperature, feels-like, wind, humidity, precipitation).',
    parameters: {
      type: 'object',
      properties: {
        latitude: { type: 'number', description: 'Latitude coordinate (-90.0 to 90.0)' },
        longitude: { type: 'number', description: 'Longitude coordinate (-180.0 to 180.0)' },
        locationName: { type: 'string', description: 'Optional location label' },
      },
      required: ['latitude', 'longitude'],
    },
    handler: getCurrentWeatherHandler,
  },
  {
    name: 'get_hourly_forecast',
    description: 'Retrieves 24-hour meteorological forecast broken down by hour (temperatures, precipitation chances, wind).',
    parameters: {
      type: 'object',
      properties: {
        latitude: { type: 'number', description: 'Latitude coordinate' },
        longitude: { type: 'number', description: 'Longitude coordinate' },
        hours: { type: 'number', description: 'Number of forecast hours (default: 24, max: 48)' },
        locationName: { type: 'string', description: 'Optional location label' },
      },
      required: ['latitude', 'longitude'],
    },
    handler: getHourlyForecastHandler,
  },
  {
    name: 'get_daily_forecast',
    description: 'Retrieves 7-day daily meteorological forecast with high/low temperatures and precipitation sums.',
    parameters: {
      type: 'object',
      properties: {
        latitude: { type: 'number', description: 'Latitude coordinate' },
        longitude: { type: 'number', description: 'Longitude coordinate' },
        days: { type: 'number', description: 'Number of forecast days (1 to 7)' },
        locationName: { type: 'string', description: 'Optional location label' },
      },
      required: ['latitude', 'longitude'],
    },
    handler: getDailyForecastHandler,
  },
  {
    name: 'get_weather_alerts',
    description: 'Retrieves severe weather warnings and disaster threshold alerts (floods, cyclones, heatwaves, gales).',
    parameters: {
      type: 'object',
      properties: {
        latitude: { type: 'number', description: 'Latitude coordinate' },
        longitude: { type: 'number', description: 'Longitude coordinate' },
        locationName: { type: 'string', description: 'Optional location label' },
      },
      required: ['latitude', 'longitude'],
    },
    handler: getWeatherAlertsHandler,
  },
  {
    name: 'get_location_weather',
    description: 'Looks up comprehensive weather by named query (e.g. "Mumbai", "Shimla") or geographical coordinates.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Place name or city query' },
        latitude: { type: 'number', description: 'Optional latitude if known' },
        longitude: { type: 'number', description: 'Optional longitude if known' },
      },
      required: [],
    },
    handler: getLocationWeatherHandler,
  },
  {
    name: 'get_historical_weather',
    description: 'Retrieves recorded historical weather observations (annual rainfall mm, recorded temperatures) from Open-Meteo Archive.',
    parameters: {
      type: 'object',
      properties: {
        latitude: { type: 'number', description: 'Latitude coordinate' },
        longitude: { type: 'number', description: 'Longitude coordinate' },
        year: { type: 'number', description: 'Past year (e.g. 2025, 2024)' },
        startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' },
      },
      required: ['latitude', 'longitude'],
    },
    handler: getHistoricalWeatherHandler,
  },
  {
    name: 'get_climate_trends',
    description: 'Computes multi-year climate trends, annual rainfall comparison, and percentage changes across multiple years.',
    parameters: {
      type: 'object',
      properties: {
        latitude: { type: 'number', description: 'Latitude coordinate' },
        longitude: { type: 'number', description: 'Longitude coordinate' },
        years: { type: 'array', items: { type: 'number' }, description: 'Array of years to compare (e.g. [2023, 2024, 2025])' },
      },
      required: ['latitude', 'longitude'],
    },
    handler: getClimateTrendsHandler,
  },
  {
    name: 'generate_weather_advisory',
    description: 'Generates safety precautions, public health guidance, and operational advice based on verified weather conditions.',
    parameters: {
      type: 'object',
      properties: {
        weatherData: { type: 'object', description: 'Meteorological payload' },
        warnings: { type: 'array', description: 'Active alerts list' },
        userContext: { type: 'object', description: 'User situation context' },
      },
      required: ['weatherData'],
    },
    handler: generateWeatherAdvisoryHandler,
  },
  {
    name: 'get_nwp_forecast',
    description: 'Retrieves Numerical Weather Prediction (NWP) model data (NOAA GFS, ECMWF IFS, or WRF mesoscale simulation) with complete model metadata (resolution, run cycle, forecast horizon).',
    parameters: {
      type: 'object',
      properties: {
        latitude: { type: 'number', description: 'Latitude coordinate' },
        longitude: { type: 'number', description: 'Longitude coordinate' },
        model: { type: 'string', enum: ['gfs', 'ecmwf', 'wrf'], description: 'NWP model identifier (default: gfs)' },
        days: { type: 'number', description: 'Number of forecast days (1 to 16)' },
        locationName: { type: 'string', description: 'Optional location label' },
      },
      required: ['latitude', 'longitude'],
    },
    handler: getNwpForecastHandler,
  },
  {
    name: 'compare_nwp_models',
    description: 'Compares numerical weather prediction outputs across GFS, ECMWF, and WRF models, calculating ensemble consensus, spread, and confidence.',
    parameters: {
      type: 'object',
      properties: {
        latitude: { type: 'number', description: 'Latitude coordinate' },
        longitude: { type: 'number', description: 'Longitude coordinate' },
        days: { type: 'number', description: 'Comparison horizon in days (default: 3)' },
        locationName: { type: 'string', description: 'Optional location label' },
      },
      required: ['latitude', 'longitude'],
    },
    handler: compareNwpModelsHandler,
  },
  {
    name: 'get_local_weather_risk',
    description: 'Evaluates Resonix Local Weather Risk Assessment (decision-support layer) using 7 factual signals (rainfall, rain probability, wind, warnings, forecast intensity, historical context, citizen reports) with deterministic scoring (LOW, MODERATE, HIGH, CRITICAL) and three-pillar separation.',
    parameters: {
      type: 'object',
      properties: {
        latitude: { type: 'number', description: 'Latitude coordinate' },
        longitude: { type: 'number', description: 'Longitude coordinate' },
        radiusKm: { type: 'number', description: 'Radius in km for nearby citizen incident lookup (default: 25)' },
        locationName: { type: 'string', description: 'Optional location label' },
      },
      required: ['latitude', 'longitude'],
    },
    handler: getLocalWeatherRiskHandler,
  },
  {
    name: 'get_sector_advisory',
    description: 'Retrieves sector-specific meteorological guidance and advisory constraints for farming, aviation, and marine sectors.',
    parameters: {
      type: 'object',
      properties: {
        latitude: { type: 'number', description: 'Latitude coordinate' },
        longitude: { type: 'number', description: 'Longitude coordinate' },
        sector: { type: 'string', enum: ['farmer', 'aviation', 'marine'], description: 'Target sector' },
        locationName: { type: 'string', description: 'Optional location label' },
      },
      required: ['latitude', 'longitude'],
    },
    handler: getSectorAdvisoryHandler,
  },
];

// Automatically register all weather tools into ToolRegistry if not already present
WEATHER_TOOLS_DEFINITIONS.forEach((toolDef) => {
  if (toolRegistry && typeof toolRegistry.registerTool === 'function') {
    try {
      if (!toolRegistry.isValidTool(toolDef.name)) {
        toolRegistry.registerTool(toolDef);
      }
    } catch (err) {
      logger.debug(`[WeatherTools] Registration note for ${toolDef.name}: ${err.message}`);
    }
  }
});

async function executeWeatherTool(toolName, params = {}) {
  switch (toolName) {
    case 'get_current_weather':
      return getCurrentWeatherHandler(params);
    case 'get_hourly_forecast':
      return getHourlyForecastHandler(params);
    case 'get_daily_forecast':
      return getDailyForecastHandler(params);
    case 'get_weather_alerts':
      return getWeatherAlertsHandler(params);
    case 'get_location_weather':
      return getLocationWeatherHandler(params);
    case 'get_historical_weather':
      return getHistoricalWeatherHandler(params);
    case 'get_climate_trends':
      return getClimateTrendsHandler(params);
    case 'generate_weather_advisory':
      return generateWeatherAdvisoryHandler(params);
    case 'get_nwp_forecast':
      return getNwpForecastHandler(params);
    case 'compare_nwp_models':
      return compareNwpModelsHandler(params);
    case 'get_local_weather_risk':
      return getLocalWeatherRiskHandler(params);
    case 'get_sector_advisory':
      return getSectorAdvisoryHandler(params);
    default:
      throw new Error(`Unknown weather tool: ${toolName}`);
  }
}

module.exports = {
  WEATHER_TOOLS_DEFINITIONS,
  executeWeatherTool,
  getCurrentWeatherHandler,
  getHourlyForecastHandler,
  getDailyForecastHandler,
  getWeatherAlertsHandler,
  getLocationWeatherHandler,
  getHistoricalWeatherHandler,
  getClimateTrendsHandler,
  generateWeatherAdvisoryHandler,
  getNwpForecastHandler,
  compareNwpModelsHandler,
  getLocalWeatherRiskHandler,
  getSectorAdvisoryHandler,
};
