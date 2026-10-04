/**
 * Weather Normalizer
 * 
 * Maps raw provider responses into the canonical Resonix internal weather schema.
 * Normalizes units:
 * - Temperature: Celsius (°C)
 * - Wind Speed: km/h
 * - Wind Direction: Degrees (0-360°)
 * - Precipitation & Rainfall: mm
 * - Humidity: Percentage (0-100%)
 * - Probability: Percentage (0-100%)
 */

// WMO Standard Weather Code to Human-readable Description and Severity Mapping
const WMO_CODE_TABLE = {
  0: { description: 'Clear sky', condition: 'CLEAR', icon: 'clear_day', severity: 'NORMAL' },
  1: { description: 'Mainly clear', condition: 'MAINLY_CLEAR', icon: 'partly_cloudy_day', severity: 'NORMAL' },
  2: { description: 'Partly cloudy', condition: 'PARTLY_CLOUDY', icon: 'partly_cloudy_day', severity: 'NORMAL' },
  3: { description: 'Overcast', condition: 'OVERCAST', icon: 'cloud', severity: 'NORMAL' },
  45: { description: 'Fog', condition: 'FOG', icon: 'foggy', severity: 'MODERATE' },
  48: { description: 'Depositing rime fog', condition: 'FREEZING_FOG', icon: 'foggy', severity: 'MODERATE' },
  51: { description: 'Light drizzle', condition: 'DRIZZLE', icon: 'rainy_light', severity: 'NORMAL' },
  53: { description: 'Moderate drizzle', condition: 'DRIZZLE', icon: 'rainy', severity: 'NORMAL' },
  55: { description: 'Dense drizzle', condition: 'HEAVY_DRIZZLE', icon: 'rainy_heavy', severity: 'MODERATE' },
  56: { description: 'Light freezing drizzle', condition: 'FREEZING_DRIZZLE', icon: 'weather_snowy', severity: 'MODERATE' },
  57: { description: 'Dense freezing drizzle', condition: 'FREEZING_DRIZZLE', icon: 'weather_snowy', severity: 'HIGH' },
  61: { description: 'Slight rain', condition: 'RAIN', icon: 'rainy_light', severity: 'NORMAL' },
  63: { description: 'Moderate rain', condition: 'RAIN', icon: 'rainy', severity: 'MODERATE' },
  65: { description: 'Heavy rain', condition: 'HEAVY_RAIN', icon: 'rainy_heavy', severity: 'HIGH' },
  66: { description: 'Light freezing rain', condition: 'FREEZING_RAIN', icon: 'weather_snowy', severity: 'HIGH' },
  67: { description: 'Heavy freezing rain', condition: 'FREEZING_RAIN', icon: 'weather_snowy', severity: 'CRITICAL' },
  71: { description: 'Slight snow fall', condition: 'SNOW', icon: 'weather_snowy', severity: 'MODERATE' },
  73: { description: 'Moderate snow fall', condition: 'SNOW', icon: 'weather_snowy', severity: 'HIGH' },
  75: { description: 'Heavy snow fall', condition: 'HEAVY_SNOW', icon: 'weather_snowy', severity: 'CRITICAL' },
  77: { description: 'Snow grains', condition: 'SNOW', icon: 'weather_snowy', severity: 'MODERATE' },
  80: { description: 'Slight rain showers', condition: 'RAIN_SHOWERS', icon: 'rainy', severity: 'NORMAL' },
  81: { description: 'Moderate rain showers', condition: 'RAIN_SHOWERS', icon: 'rainy', severity: 'MODERATE' },
  82: { description: 'Violent rain showers', condition: 'VIOLENT_RAIN_SHOWERS', icon: 'flood', severity: 'CRITICAL' },
  85: { description: 'Slight snow showers', condition: 'SNOW_SHOWERS', icon: 'weather_snowy', severity: 'MODERATE' },
  86: { description: 'Heavy snow showers', condition: 'HEAVY_SNOW_SHOWERS', icon: 'weather_snowy', severity: 'CRITICAL' },
  95: { description: 'Thunderstorm', condition: 'THUNDERSTORM', icon: 'thunderstorm', severity: 'HIGH' },
  96: { description: 'Thunderstorm with slight hail', condition: 'THUNDERSTORM_HAIL', icon: 'thunderstorm', severity: 'CRITICAL' },
  99: { description: 'Thunderstorm with heavy hail', condition: 'THUNDERSTORM_HAIL', icon: 'thunderstorm', severity: 'CRITICAL' },
};

/**
 * Resolve WMO code details
 * @param {number} code
 * @returns {Object}
 */
function resolveWmoCode(code) {
  const numericCode = Number(code);
  return WMO_CODE_TABLE[numericCode] || {
    description: 'Unknown weather condition',
    condition: 'UNKNOWN',
    icon: 'cloud',
    severity: 'NORMAL',
  };
}

/**
 * Round number safely to decimal places
 * @param {number|*} val
 * @param {number} [decimals=1]
 * @returns {number|null}
 */
function roundNum(val, decimals = 1) {
  if (val === null || val === undefined || isNaN(Number(val))) return null;
  const factor = Math.pow(10, decimals);
  return Math.round(Number(val) * factor) / factor;
}

/**
 * Normalize current weather measurements
 * @param {Object} rawCurrent
 * @returns {Object}
 */
function normalizeCurrent(rawCurrent = {}) {
  const code = rawCurrent.weather_code ?? rawCurrent.weatherCode ?? rawCurrent.conditionCode ?? 0;
  const wmo = resolveWmoCode(code);

  const temp = roundNum(rawCurrent.temperature_2m ?? rawCurrent.temperature ?? rawCurrent.temp);
  const feelsLike = roundNum(rawCurrent.apparent_temperature ?? rawCurrent.feels_like ?? rawCurrent.feelsLike);
  const humidity = roundNum(rawCurrent.relative_humidity_2m ?? rawCurrent.humidity, 0);
  const windSpeed = roundNum(rawCurrent.wind_speed_10m ?? rawCurrent.windSpeed ?? rawCurrent.wind_kph);
  const windDirection = roundNum(rawCurrent.wind_direction_10m ?? rawCurrent.windDirection ?? rawCurrent.wind_degree, 0);
  const rawPrecip = rawCurrent.precipitation ?? rawCurrent.precip_mm;
  const precipitation = rawPrecip !== undefined && rawPrecip !== null ? roundNum(rawPrecip) : null;
  const rawRain = rawCurrent.rain ?? rawCurrent.rainfall ?? rawPrecip;
  const rainfall = rawRain !== undefined && rawRain !== null ? roundNum(rawRain) : null;
  const isDay = rawCurrent.is_day !== undefined ? Boolean(rawCurrent.is_day) : true;

  // Derive rain probability from humidity and condition if not explicitly provided
  let rainProb = rawCurrent.precipitation_probability ?? rawCurrent.rainProbability;
  if (rainProb === undefined || rainProb === null) {
    if (precipitation > 0 || [61, 63, 65, 80, 81, 82, 95, 96, 99].includes(Number(code))) {
      rainProb = Math.min(100, Math.max(70, Math.round((humidity || 75))));
    } else if ([51, 53, 55].includes(Number(code))) {
      rainProb = 50;
    } else {
      rainProb = 10;
    }
  }

  return {
    temperature: temp,
    feelsLike,
    humidity,
    windSpeed,
    windDirection,
    precipitation,
    rainfall,
    rainProbability: roundNum(rainProb, 0),
    condition: wmo.description,
    conditionCode: wmo.condition,
    weatherCode: Number(code),
    icon: wmo.icon,
    severity: wmo.severity,
    isDay,
  };
}

/**
 * Normalize hourly forecast array
 * @param {Object} rawHourly
 * @param {number} [limit=24]
 * @returns {Array<Object>}
 */
function normalizeHourly(rawHourly = {}, limit = 24) {
  if (!rawHourly || !Array.isArray(rawHourly.time)) {
    if (Array.isArray(rawHourly)) {
      return rawHourly.slice(0, limit);
    }
    return [];
  }

  const times = rawHourly.time;
  const temps = rawHourly.temperature_2m || [];
  const humidities = rawHourly.relative_humidity_2m || [];
  const rainProbs = rawHourly.precipitation_probability || [];
  const precips = rawHourly.precipitation || [];
  const codes = rawHourly.weather_code || [];
  const winds = rawHourly.wind_speed_10m || [];

  const count = Math.min(times.length, limit);
  const hourly = [];

  for (let i = 0; i < count; i++) {
    const code = codes[i] != null ? codes[i] : 0;
    const wmo = resolveWmoCode(code);
    hourly.push({
      time: times[i],
      temperature: roundNum(temps[i]),
      humidity: roundNum(humidities[i], 0),
      precipitationProbability: rainProbs[i] != null ? roundNum(rainProbs[i], 0) : null,
      precipitation: precips[i] != null ? roundNum(precips[i]) : null,
      windSpeed: roundNum(winds[i]),
      condition: wmo.description,
      conditionCode: wmo.condition,
      weatherCode: Number(code),
      icon: wmo.icon,
    });
  }

  return hourly;
}

/**
 * Normalize daily forecast array
 * @param {Object} rawDaily
 * @param {number} [limit=7]
 * @returns {Array<Object>}
 */
function normalizeDaily(rawDaily = {}, limit = 7) {
  if (!rawDaily || !Array.isArray(rawDaily.time)) {
    if (Array.isArray(rawDaily)) {
      return rawDaily.slice(0, limit);
    }
    return [];
  }

  const dates = rawDaily.time;
  const tempMax = rawDaily.temperature_2m_max || [];
  const tempMin = rawDaily.temperature_2m_min || [];
  const precipSums = rawDaily.precipitation_sum || [];
  const rainProbs = rawDaily.precipitation_probability_max || [];
  const codes = rawDaily.weather_code || [];
  const windMax = rawDaily.wind_speed_10m_max || [];

  const count = Math.min(dates.length, limit);
  const daily = [];

  for (let i = 0; i < count; i++) {
    const code = codes[i] != null ? codes[i] : 0;
    const wmo = resolveWmoCode(code);
    daily.push({
      date: dates[i],
      temperatureMax: roundNum(tempMax[i]),
      temperatureMin: roundNum(tempMin[i]),
      precipitationSum: precipSums[i] != null ? roundNum(precipSums[i]) : null,
      precipitationProbabilityMax: rainProbs[i] != null ? roundNum(rainProbs[i], 0) : null,
      windSpeedMax: roundNum(windMax[i]),
      condition: wmo.description,
      conditionCode: wmo.condition,
      weatherCode: Number(code),
      icon: wmo.icon,
      severity: wmo.severity,
    });
  }

  return daily;
}

/**
 * Generate automated severe weather warnings based on normalized meteorological thresholds
 * @param {Object} current
 * @param {Array<Object>} daily
 * @param {string} source
 * @returns {Array<Object>}
 */
function deriveWeatherWarnings(current = {}, daily = [], source = 'Meteorological Sensor Network') {
  const warnings = [];
  const nowIso = new Date().toISOString();
  const expiresIso = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();

  // 1. Torrential / Violent Precipitation Warning
  if (current.precipitation >= 25 || current.rainfall >= 25 || current.weatherCode === 82) {
    warnings.push({
      id: `WRN-RAIN-${Date.now()}`,
      severity: current.precipitation >= 50 ? 'EMERGENCY' : 'WARNING',
      category: 'FLOOD_RISK',
      headline: current.precipitation >= 50 ? 'FLASH FLOOD EMERGENCY: Extreme Inundation' : 'HEAVY RAINFALL WARNING',
      description: `Observed precipitation of ${current.precipitation} mm/h. High probability of rapid surface runoff and localized waterlogging.`,
      effective: nowIso,
      expires: expiresIso,
      source,
    });
  }

  // 2. Severe Thunderstorm & Hail Hazard
  if ([95, 96, 99].includes(current.weatherCode)) {
    warnings.push({
      id: `WRN-STORM-${Date.now()}`,
      severity: current.weatherCode === 99 ? 'EMERGENCY' : 'WARNING',
      category: 'THUNDERSTORM',
      headline: current.weatherCode === 99 ? 'VIOLENT THUNDERSTORM & HAIL HAZARD' : 'SEVERE THUNDERSTORM ALERT',
      description: 'Active atmospheric electrical instability with localized lightning strikes and potential hail damage.',
      effective: nowIso,
      expires: expiresIso,
      source,
    });
  }

  // 3. Gale-Force Wind Warning
  if (current.windSpeed >= 50) {
    warnings.push({
      id: `WRN-WIND-${Date.now()}`,
      severity: current.windSpeed >= 75 ? 'EMERGENCY' : 'WARNING',
      category: 'HIGH_WIND',
      headline: current.windSpeed >= 75 ? 'DESTRUCTIVE GALE WIND ALERT' : 'HIGH WIND ADVISORY',
      description: `Sustained wind velocities reaching ${current.windSpeed} km/h. Danger of falling trees, debris, and structural stress.`,
      effective: nowIso,
      expires: expiresIso,
      source,
    });
  }

  // 4. Extreme Thermal Extremes (Heatwave / Coldwave)
  if (current.temperature >= 42) {
    warnings.push({
      id: `WRN-HEAT-${Date.now()}`,
      severity: current.temperature >= 45 ? 'EMERGENCY' : 'WARNING',
      category: 'HEATWAVE',
      headline: 'SEVERE HEATWAVE ADVISORY',
      description: `Ambient temperature at ${current.temperature}°C (Feels like ${current.feelsLike}°C). Elevated risk of heat exhaustion and hyperthermia.`,
      effective: nowIso,
      expires: expiresIso,
      source,
    });
  } else if (current.temperature !== null && current.temperature <= 2) {
    warnings.push({
      id: `WRN-COLD-${Date.now()}`,
      severity: 'WARNING',
      category: 'COLDWAVE',
      headline: 'COLDWAVE / FROST WARNING',
      description: `Temperature dropping to ${current.temperature}°C with potential frost and icing hazards.`,
      effective: nowIso,
      expires: expiresIso,
      source,
    });
  }

  return warnings;
}

/**
 * Main Normalizer Facade
 * @param {Object} rawData - Provider payload
 * @param {Object} context - Metadata (lat, lon, locationName, providerName, etc.)
 * @returns {Object} Canonical normalized weather schema
 */
function normalizeWeatherPayload(rawData = {}, context = {}) {
  const lat = roundNum(context.lat ?? rawData.latitude, 4);
  const lon = roundNum(context.lon ?? rawData.longitude, 4);
  const locationName = context.locationName || rawData.locationName || (lat && lon ? `Location (${lat}, ${lon})` : 'Unknown Location');
  const timezone = rawData.timezone || context.timezone || 'UTC';
  const source = context.source || rawData.source || 'Open-Meteo Meteorological Ensemble';

  const current = normalizeCurrent(rawData.current || rawData.current_weather || rawData);
  const hourlyForecast = normalizeHourly(rawData.hourly, 24);
  const dailyForecast = normalizeDaily(rawData.daily, 7);
  
  // Combine explicit provider warnings with derived meteorological threshold warnings
  const rawWarnings = Array.isArray(rawData.warnings) ? rawData.warnings : [];
  const derivedWarnings = deriveWeatherWarnings(current, dailyForecast, source);
  const warnings = [...rawWarnings, ...derivedWarnings];

  const now = new Date().toISOString();

  return {
    location: {
      latitude: lat,
      longitude: lon,
      name: locationName,
      country: context.country || rawData.country || '',
      admin1: context.admin1 || rawData.admin1 || '',
      timezone,
    },
    timestamp: now,
    current,
    hourlyForecast,
    dailyForecast,
    warnings,
    metadata: {
      source,
      sourceUpdateTime: rawData.current?.time || rawData.sourceUpdateTime || now,
      cachedAt: context.cachedAt || now,
      isStale: Boolean(context.isStale),
      ttlSeconds: context.ttlSeconds || 600,
    },
  };
}

/**
 * Normalize Numerical Weather Prediction (NWP) forecast payload
 * @param {Object} rawData - Raw API response
 * @param {Object} [metaOverride] - Explicit model metadata
 * @returns {Object} Canonical NWP forecast object
 */
function normalizeNwpForecast(rawData = {}, metaOverride = {}) {
  const lat = roundNum(rawData.latitude, 4);
  const lon = roundNum(rawData.longitude, 4);
  const timezone = rawData.timezone || 'UTC';
  const now = new Date().toISOString();

  const modelMeta = {
    source: metaOverride.source || rawData.modelMetadata?.source || rawData.source || 'NWP Meteorological Model',
    model: metaOverride.model || rawData.modelMetadata?.model || 'Numerical Weather Prediction',
    modelId: metaOverride.modelId || rawData.modelMetadata?.modelId || 'nwp',
    resolution: metaOverride.resolution || rawData.modelMetadata?.resolution || 'Standard NWP Grid',
    forecastHorizonHours: metaOverride.forecastHorizonHours || rawData.modelMetadata?.forecastHorizonHours || 168,
    runCycle: metaOverride.runCycle || rawData.modelMetadata?.runCycle || 'Periodic Run',
    boundaryConditions: metaOverride.boundaryConditions || rawData.modelMetadata?.boundaryConditions || 'Standard assimilation',
    updateTime: rawData.sourceUpdateTime || rawData.modelMetadata?.updateTime || now,
  };

  // 1. Normalize Hourly Time Series
  const hourlyRaw = rawData.hourly || {};
  const times = Array.isArray(hourlyRaw.time) ? hourlyRaw.time : [];
  const temps = hourlyRaw.temperature_2m || [];
  const humidities = hourlyRaw.relative_humidity_2m || [];
  const precips = hourlyRaw.precipitation || hourlyRaw.rain || [];
  const windSpeeds = hourlyRaw.wind_speed_10m || [];
  const windDirs = hourlyRaw.wind_direction_10m || [];
  const pressures = hourlyRaw.surface_pressure || [];
  const codes = hourlyRaw.weather_code || [];

  const hourly = [];
  for (let i = 0; i < times.length; i++) {
    const code = codes[i] ?? 0;
    const wmo = resolveWmoCode(code);
    hourly.push({
      forecastTimestamp: times[i],
      time: times[i],
      temperature: roundNum(temps[i]),
      humidity: roundNum(humidities[i], 0),
      precipitation: roundNum(precips[i] ?? 0),
      windSpeed: roundNum(windSpeeds[i]),
      windDirection: roundNum(windDirs[i], 0),
      surfacePressure: roundNum(pressures[i]),
      condition: wmo.description,
      conditionCode: wmo.condition,
      icon: wmo.icon,
    });
  }

  // 2. Normalize Daily Summaries
  const dailyRaw = rawData.daily || {};
  const dTimes = Array.isArray(dailyRaw.time) ? dailyRaw.time : [];
  const maxTemps = dailyRaw.temperature_2m_max || [];
  const minTemps = dailyRaw.temperature_2m_min || [];
  const precipSums = dailyRaw.precipitation_sum || [];
  const maxWinds = dailyRaw.wind_speed_10m_max || [];
  const dCodes = dailyRaw.weather_code || [];

  const daily = [];
  for (let i = 0; i < dTimes.length; i++) {
    const code = dCodes[i] ?? 0;
    const wmo = resolveWmoCode(code);
    daily.push({
      date: dTimes[i],
      forecastTimestamp: `${dTimes[i]}T00:00:00Z`,
      temperatureMax: roundNum(maxTemps[i]),
      temperatureMin: roundNum(minTemps[i]),
      precipitationSum: roundNum(precipSums[i] ?? 0),
      windSpeedMax: roundNum(maxWinds[i]),
      condition: wmo.description,
      icon: wmo.icon,
    });
  }

  // 3. Compute High-Level Forecast Summary
  const validTemps = hourly.map(h => h.temperature).filter(t => t != null);
  const totalPrecip = hourly.reduce((sum, h) => sum + (h.precipitation || 0), 0);
  const summary = {
    horizonHours: times.length,
    minForecastTemp: validTemps.length > 0 ? Math.min(...validTemps) : null,
    maxForecastTemp: validTemps.length > 0 ? Math.max(...validTemps) : null,
    totalForecastPrecipitationMm: roundNum(totalPrecip),
    peakRainTimestamp: hourly.reduce((peak, curr) => (curr.precipitation > (peak?.precipitation || 0) ? curr : peak), null)?.forecastTimestamp || null,
  };

  return {
    latitude: lat,
    longitude: lon,
    timezone,
    timestamp: now,
    modelMetadata: modelMeta,
    summary,
    hourly,
    daily,
  };
}

/**
 * Normalize and align multi-model comparison across multiple NWP providers
 * @param {Object} rawComparison - Output from NwpMultiModelService.fetchMultiModelComparison
 * @returns {Object} Synchronized comparison object with consensus and spread
 */
function normalizeMultiModelComparison(rawComparison = {}) {
  const models = rawComparison.models || [];
  const normalizedModels = {};
  const metadataList = [];

  models.forEach((m) => {
    if (m.success && m.data) {
      const normalized = normalizeNwpForecast(m.data, m.metadata);
      normalizedModels[m.modelId] = normalized;
      metadataList.push(normalized.modelMetadata);
    }
  });

  const activeModelIds = Object.keys(normalizedModels);
  if (activeModelIds.length === 0) {
    return {
      latitude: rawComparison.latitude,
      longitude: rawComparison.longitude,
      timestamp: rawComparison.timestamp || new Date().toISOString(),
      models: {},
      comparisonTimeline: [],
      consensus: null,
      metadataList: [],
    };
  }

  // Align timestamps (using first active model as timeline reference, up to 72h)
  const refModel = normalizedModels[activeModelIds[0]];
  const refTimes = refModel.hourly.slice(0, 72).map(h => h.forecastTimestamp);

  const comparisonTimeline = [];
  refTimes.forEach((timeStr, idx) => {
    const step = {
      forecastTimestamp: timeStr,
      predictions: {},
      temperatures: [],
      precipitations: [],
    };

    activeModelIds.forEach((mId) => {
      const h = normalizedModels[mId].hourly[idx] || normalizedModels[mId].hourly.find(x => x.forecastTimestamp === timeStr);
      if (h) {
        step.predictions[mId] = {
          temperature: h.temperature,
          precipitation: h.precipitation,
          windSpeed: h.windSpeed,
          humidity: h.humidity,
          condition: h.condition,
        };
        if (h.temperature != null) step.temperatures.push(h.temperature);
        if (h.precipitation != null) step.precipitations.push(h.precipitation);
      }
    });

    // Consensus metrics
    const meanTemp = step.temperatures.length > 0
      ? roundNum(step.temperatures.reduce((a, b) => a + b, 0) / step.temperatures.length)
      : null;
    const tempSpread = step.temperatures.length > 1
      ? roundNum(Math.max(...step.temperatures) - Math.min(...step.temperatures))
      : 0;
    const meanPrecip = step.precipitations.length > 0
      ? roundNum(step.precipitations.reduce((a, b) => a + b, 0) / step.precipitations.length)
      : 0;

    step.consensus = {
      meanTemperature: meanTemp,
      temperatureSpread: tempSpread,
      meanPrecipitation: meanPrecip,
      confidence: tempSpread <= 2.0 ? 'HIGH' : tempSpread <= 4.0 ? 'MODERATE' : 'LOW',
    };

    comparisonTimeline.push(step);
  });

  return {
    latitude: rawComparison.latitude,
    longitude: rawComparison.longitude,
    timestamp: rawComparison.timestamp || new Date().toISOString(),
    activeModelCount: activeModelIds.length,
    models: normalizedModels,
    comparisonTimeline,
    metadataList,
  };
}

module.exports = {
  normalizeWeatherPayload,
  normalizeCurrent,
  normalizeHourly,
  normalizeDaily,
  normalizeNwpForecast,
  normalizeMultiModelComparison,
  deriveWeatherWarnings,
  resolveWmoCode,
  WMO_CODE_TABLE,
};

