/**
 * Weather Service (Orchestrator Facade)
 * 
 * Central coordinator for Resonix AI Weather Intelligence subsystem.
 * Encapsulates:
 * - Provider independence & dynamic provider swappability
 * - Two-tier caching with spatial quantization & stale-on-failure recovery
 * - Input & output validation
 * - Canonical schema normalization
 * - Safe error mapping (400 / 502 / 503 / 504)
 */

const OpenMeteoProvider = require('./providers/openMeteoProvider');
const defaultCache = require('./weatherCache');
const {
  normalizeWeatherPayload,
  normalizeCurrent,
  normalizeHourly,
  normalizeDaily,
  normalizeNwpForecast,
  normalizeMultiModelComparison,
  deriveWeatherWarnings,
} = require('./weatherNormalizer');
const {
  validateCoordinates,
  validateLocationQuery,
  validateWeatherResponse,
} = require('./weatherValidator');
const { enrichMetadataWithFreshness } = require('../../utils/weatherFreshness');
const ApiError = require('../../utils/apiError');
const logger = require('../../utils/logger');

class WeatherService {
  constructor(options = {}) {
    this.provider = options.provider || new OpenMeteoProvider();
    this.cache = options.cache || defaultCache;
  }

  /**
   * Dynamically set or swap the active weather provider
   * @param {WeatherProvider} provider
   */
  setProvider(provider) {
    if (!provider || typeof provider.getName !== 'function') {
      throw new TypeError('Invalid weather provider: Must implement WeatherProvider interface.');
    }
    this.provider = provider;
    logger.info(`[WeatherService] Active weather provider updated to: ${provider.getName()}`);
  }

  /**
   * Return name of active weather provider
   * @returns {string}
   */
  getProviderName() {
    return this.provider.getName();
  }

  /**
   * Internal execution helper with caching, timeout handling, and stale fallback
   * @private
   */
  async _executeWithResilience(type, lat, lon, fetchFn, options = {}) {
    const { lat: validLat, lon: validLon } = validateCoordinates(lat, lon);

    // 1. Check fresh in-memory cache (unless bypass requested)
    if (!options.bypassCache) {
      const cached = this.cache.get(type, validLat, validLon);
      if (cached) {
        if (cached.metadata) {
          cached.metadata = enrichMetadataWithFreshness({
            ...cached.metadata,
            isCached: true,
          });
        }
        return cached;
      }
    }

    // 2. Query Live Provider
    try {
      const rawPayload = await fetchFn(validLat, validLon, options);
      const normalized = normalizeWeatherPayload(rawPayload, {
        lat: validLat,
        lon: validLon,
        locationName: options.locationName,
        source: this.provider.getName(),
        isStale: false,
      });

      // 3. Validate meteorological sanity of response
      validateWeatherResponse(normalized);

      // 4. Enrich with computed freshness metadata
      normalized.metadata = enrichMetadataWithFreshness({
        ...normalized.metadata,
        isCached: false,
        isStale: false,
      });

      // 5. Cache fresh response in-memory
      this.cache.set(type, validLat, validLon, normalized);

      return normalized;
    } catch (err) {
      logger.warn(`[WeatherService] Upstream provider error (${err.code || err.name}): ${err.message}`);

      // 6. Try stale in-memory cache fallback
      const stale = this.cache.getStale(type, validLat, validLon);
      if (stale) {
        logger.info(`[WeatherService] Serving stale in-memory cached ${type} weather for (${validLat}, ${validLon}) during provider failure.`);
        return {
          ...stale,
          metadata: enrichMetadataWithFreshness({
            ...(stale.metadata || {}),
            isCached: true,
            isStale: true,
          }),
        };
      }

      // 7. Try MongoDB WeatherSnapshot persistent fallback (survives server reboots)
      try {
        const WeatherSnapshot = require('../../models/WeatherSnapshot');
        if (WeatherSnapshot?.db?.readyState === 1) {
          const qLat = this.cache.quantize(validLat);
          const qLon = this.cache.quantize(validLon);
          const gridKey = `${qLat}:${qLon}`;
          const snapshot = await WeatherSnapshot.findOne({ gridKey }).lean();
          if (snapshot && snapshot.current) {
            logger.info(`[WeatherService] Serving persisted MongoDB WeatherSnapshot for grid ${gridKey} during provider failure.`);
            const snapshotData = {
              location: {
                latitude: snapshot.latitude,
                longitude: snapshot.longitude,
                name: snapshot.locationName,
                timezone: snapshot.timezone,
              },
              timestamp: snapshot.lastSuccessfulFetch ? new Date(snapshot.lastSuccessfulFetch).toISOString() : new Date().toISOString(),
              current: snapshot.current,
              hourlyForecast: snapshot.hourlyForecast || [],
              dailyForecast: snapshot.dailyForecast || [],
              warnings: snapshot.warnings || [],
              metadata: enrichMetadataWithFreshness({
                ...(snapshot.metadata || {}),
                isCached: true,
                isStale: true,
                cachedAt: snapshot.lastSuccessfulFetch ? new Date(snapshot.lastSuccessfulFetch).toISOString() : snapshot.metadata?.cachedAt,
              }),
            };
            this.cache.set(type, validLat, validLon, snapshotData);
            return snapshotData;
          }
        }
      } catch (dbErr) {
        logger.debug(`[WeatherService] MongoDB snapshot fallback note: ${dbErr.message}`);
      }

      // 8. Map to standardized HTTP error
      if (err instanceof ApiError) throw err;

      if (err.code === 'PROVIDER_TIMEOUT' || err.status === 504) {
        throw new ApiError(504, 'Weather service request timed out. Upstream meteorological provider did not respond in time.');
      }

      if (err.code === 'PROVIDER_RATE_LIMIT' || err.status === 429) {
        throw new ApiError(429, 'Weather service rate limit exceeded. Please retry shortly.');
      }

      if (err.code === 'PROVIDER_UNAVAILABLE' || err.status === 503) {
        throw new ApiError(503, 'Weather data currently unavailable. Meteorological provider service is offline or unreachable.');
      }

      throw new ApiError(502, `Weather provider error: ${err.message}`);
    }
  }

  /**
   * Get Comprehensive Weather (Current + Hourly + Daily + Warnings + Metadata)
   * @param {number|string} lat
   * @param {number|string} lon
   * @param {Object} [options]
   * @returns {Promise<Object>} Canonical weather schema
   */
  async getComprehensiveWeather(lat, lon, options = {}) {
    return await this._executeWithResilience(
      'COMPREHENSIVE',
      lat,
      lon,
      (vLat, vLon, opts) => this.provider.fetchComplete(vLat, vLon, opts),
      options
    );
  }

  /**
   * Get Current Weather Conditions
   * @param {number|string} lat
   * @param {number|string} lon
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  async getCurrentWeather(lat, lon, options = {}) {
    const full = await this.getComprehensiveWeather(lat, lon, options);
    return {
      location: full.location,
      timestamp: full.timestamp,
      current: full.current,
      metadata: full.metadata,
    };
  }

  /**
   * Get Hourly Weather Forecast (24 Hours)
   * @param {number|string} lat
   * @param {number|string} lon
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  async getHourlyForecast(lat, lon, options = {}) {
    const full = await this.getComprehensiveWeather(lat, lon, options);
    return {
      location: full.location,
      timestamp: full.timestamp,
      hourlyForecast: full.hourlyForecast,
      metadata: full.metadata,
    };
  }

  /**
   * Get Daily Weather Forecast (7 Days)
   * @param {number|string} lat
   * @param {number|string} lon
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  async getDailyForecast(lat, lon, options = {}) {
    const full = await this.getComprehensiveWeather(lat, lon, options);
    return {
      location: full.location,
      timestamp: full.timestamp,
      dailyForecast: full.dailyForecast,
      metadata: full.metadata,
    };
  }

  /**
   * Get Weather Warnings & Disaster Threshold Alerts
   * @param {number|string} lat
   * @param {number|string} lon
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  async getWeatherWarnings(lat, lon, options = {}) {
    const full = await this.getComprehensiveWeather(lat, lon, options);
    return {
      location: full.location,
      timestamp: full.timestamp,
      warnings: full.warnings,
      currentSummary: {
        condition: full.current.condition,
        temperature: full.current.temperature,
        windSpeed: full.current.windSpeed,
        precipitation: full.current.precipitation,
      },
      metadata: full.metadata,
    };
  }

  /**
   * Search Locations (Geocoding)
   * @param {string} query
   * @param {Object} [options]
   * @returns {Promise<Array<Object>>}
   */
  async searchLocation(query, options = {}) {
    const validQuery = validateLocationQuery(query);

    // Check location cache
    const cached = this.cache.get('LOCATION', validQuery);
    if (cached) {
      return cached;
    }

    try {
      const results = await this.provider.searchLocation(validQuery, options);
      this.cache.set('LOCATION', validQuery, undefined, results, 24 * 60 * 60 * 1000);
      return results;
    } catch (err) {
      logger.warn(`[WeatherService] Location search error for '${query}': ${err.message}`);
      
      const stale = this.cache.getStale('LOCATION', validQuery);
      if (stale) return stale;

      if (err.code === 'PROVIDER_TIMEOUT') {
        throw new ApiError(504, 'Location search request timed out.');
      }
      throw new ApiError(503, 'Location geocoding service currently unavailable.');
    }
  }

  /**
   * Reverse Geocode Coordinates to Location Name
   * @param {number|string} lat
   * @param {number|string} lon
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  async reverseGeocode(lat, lon, options = {}) {
    const { lat: validLat, lon: validLon } = validateCoordinates(lat, lon);

    const cached = this.cache.get('REV_LOC', validLat, validLon);
    if (cached) {
      return cached;
    }

    try {
      const result = await this.provider.reverseGeocode(validLat, validLon, options);
      this.cache.set('REV_LOC', validLat, validLon, result, 24 * 60 * 60 * 1000);
      return result;
    } catch (err) {
      logger.warn(`[WeatherService] Reverse geocode error for (${lat}, ${lon}): ${err.message}`);
      const stale = this.cache.getStale('REV_LOC', validLat, validLon);
      if (stale) return stale;

      const fallback = {
        latitude: validLat,
        longitude: validLon,
        name: `Sector (${validLat.toFixed(2)}, ${validLon.toFixed(2)})`,
        locality: `Sector (${validLat.toFixed(2)}, ${validLon.toFixed(2)})`,
        city: '',
        admin1: '',
        country: '',
        displayName: `Sector (${validLat.toFixed(2)}, ${validLon.toFixed(2)})`,
      };
      return fallback;
    }
  }

  /**
   * Get list of registered NWP models with metadata
   * @returns {Array<Object>}
   */
  getAvailableNwpModels() {
    const nwpMultiModelService = require('./providers/nwpMultiModelService');
    return nwpMultiModelService.listModels();
  }

  /**
   * Get Numerical Weather Prediction (NWP) forecast for a specific model (GFS, ECMWF, WRF)
   * @param {number|string} lat
   * @param {number|string} lon
   * @param {Object} [options] - { model: 'gfs'|'ecmwf'|'wrf', days: 7, bypassCache: false }
   * @returns {Promise<Object>} Normalized NWP forecast
   */
  async getNwpForecast(lat, lon, options = {}) {
    const { lat: validLat, lon: validLon } = validateCoordinates(lat, lon);
    const modelId = (options.model || 'gfs').toLowerCase();
    const cacheKey = `NWP:${modelId}`;

    // 1. In-memory cache check
    if (!options.bypassCache) {
      const cached = this.cache.get(cacheKey, validLat, validLon);
      if (cached) {
        if (cached.metadata) {
          cached.metadata = enrichMetadataWithFreshness(cached.metadata);
        }
        return cached;
      }
    }

    // 2. Query model adapter
    const nwpMultiModelService = require('./providers/nwpMultiModelService');
    try {
      const rawPayload = await nwpMultiModelService.fetchModelForecast(modelId, validLat, validLon, options);
      const adapter = nwpMultiModelService.getAdapter(modelId);
      const normalized = normalizeNwpForecast(rawPayload, adapter.getModelMetadata());

      normalized.metadata = enrichMetadataWithFreshness({
        source: normalized.modelMetadata.source,
        sourceUpdateTime: normalized.modelMetadata.updateTime,
        cachedAt: new Date().toISOString(),
        isStale: false,
        ttlSeconds: Math.round((this.cache.ttls.NWP_FORECAST || 10800000) / 1000),
      });

      this.cache.set(cacheKey, validLat, validLon, normalized, this.cache.ttls.NWP_FORECAST);
      return normalized;
    } catch (err) {
      logger.warn(`[WeatherService] NWP forecast error (${modelId}) for (${validLat}, ${validLon}): ${err.message}`);

      // 3. Stale cache fallback
      const stale = this.cache.getStale(cacheKey, validLat, validLon);
      if (stale) {
        logger.info(`[WeatherService] Serving stale cached NWP forecast (${modelId}) for (${validLat}, ${validLon}).`);
        return {
          ...stale,
          metadata: enrichMetadataWithFreshness({
            ...(stale.metadata || {}),
            isStale: true,
          }),
        };
      }

      if (err instanceof ApiError) throw err;
      throw new ApiError(502, `NWP model (${modelId.toUpperCase()}) prediction error: ${err.message}`);
    }
  }

  /**
   * Compare multiple NWP models side-by-side with consensus and spread
   * @param {number|string} lat
   * @param {number|string} lon
   * @param {Object} [options] - { days: 3, bypassCache: false }
   * @returns {Promise<Object>} Multi-model comparison schema
   */
  async getNwpModelComparison(lat, lon, options = {}) {
    const { lat: validLat, lon: validLon } = validateCoordinates(lat, lon);
    const cacheKey = 'NWP:compare';

    if (!options.bypassCache) {
      const cached = this.cache.get(cacheKey, validLat, validLon);
      if (cached) return cached;
    }

    const nwpMultiModelService = require('./providers/nwpMultiModelService');
    try {
      const rawComparison = await nwpMultiModelService.fetchMultiModelComparison(validLat, validLon, options);
      const normalized = normalizeMultiModelComparison(rawComparison);

      this.cache.set(cacheKey, validLat, validLon, normalized, this.cache.ttls.NWP_COMPARE);
      return normalized;
    } catch (err) {
      logger.warn(`[WeatherService] NWP comparison error for (${validLat}, ${validLon}): ${err.message}`);

      const stale = this.cache.getStale(cacheKey, validLat, validLon);
      if (stale) return stale;

      if (err instanceof ApiError) throw err;
      throw new ApiError(502, `NWP multi-model comparison error: ${err.message}`);
    }
  }

  /**
   * Evaluates Resonix Local Weather Risk Assessment (Decision-Support Layer)
   * Deterministically scores 7 factual signals with three-pillar separation.
   * @param {number|string} lat
   * @param {number|string} lon
   * @param {Object} [options] - { radiusKm: 25, bypassCache: false, locationName }
   * @returns {Promise<Object>} Local Weather Risk schema
   */
  async getLocalWeatherRisk(lat, lon, options = {}) {
    const { lat: validLat, lon: validLon } = validateCoordinates(lat, lon);
    const localWeatherRiskEngine = require('./localWeatherRiskEngine');
    return localWeatherRiskEngine.evaluateRisk(validLat, validLon, options);
  }

  /**
   * Conversational Weather Intelligence Query Assistant
   * Strictly grounded in real ingested meteorological measurements. Zero LLM hallucinations.
   * Handles:
   * - "weather near me" / "current weather"
   * - "will it rain here tomorrow?" / "rain forecast"
   * - "any severe warnings?" / "temperature tonight"
   * @param {string} query
   * @param {number|string} lat
   * @param {number|string} lon
   * @param {Object} [options]
   * @returns {Promise<Object>}
   * Conversational Weather Intelligence Assistant (WeatherGPT Grounded Agent)
   * 
   * Strict anti-hallucination pipeline:
   * Retrieves real meteorological data first, stratifies evidence layers:
   * [OBSERVED DATA], [FORECAST], [WARNING], [AI INTERPRETATION], [CITIZEN REPORT].
   * Retains internal metadata: location, data timestamp, forecast period, source, retrieved values.
   */
  async askWeather(query, lat, lon, options = {}) {
    if (!query || typeof query !== 'string' || !query.trim()) {
      throw new ApiError(400, 'Query text is required for conversational weather lookup.');
    }

    const weatherGptAgent = require('./weatherGptAgent');
    return weatherGptAgent.processQuery(query, lat, lon, options);
  }
}

// Export singleton instance and class definition
const defaultWeatherService = new WeatherService();

module.exports = defaultWeatherService;
module.exports.WeatherService = WeatherService;
