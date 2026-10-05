/**
 * OpenMeteo Weather Provider
 * 
 * Concrete implementation of WeatherProvider using the Open-Meteo meteorological API.
 * Free, open-source, global coverage, no API key required, authoritative WMO models.
 */

const WeatherProvider = require('./weatherProvider');
const logger = require('../../../utils/logger');

const OPEN_METEO_BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODING_BASE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const DEFAULT_TIMEOUT_MS = 6000;

class OpenMeteoProvider extends WeatherProvider {
  constructor(config = {}) {
    super('Open-Meteo Meteorological Ensemble', config);
    this.baseUrl = config.baseUrl || OPEN_METEO_BASE_URL;
    this.geocodingUrl = config.geocodingUrl || GEOCODING_BASE_URL;
    this.timeoutMs = config.timeoutMs || DEFAULT_TIMEOUT_MS;
  }

  /**
   * Internal HTTP fetch helper with AbortController timeout & rate-limit handling
   * @param {string} url
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  async _request(url, options = {}) {
    const timeout = options.timeoutMs || this.timeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Resonix-AI/1.0 (Emergency Disaster Intelligence Platform)',
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        if (response.status === 429 || errorText.includes('limit') || response.statusText?.toLowerCase().includes('too many')) {
          const err = new Error('Open-Meteo provider rate limit exceeded.');
          err.code = 'PROVIDER_RATE_LIMIT';
          err.status = 429;
          const retryAfter = response.headers?.get ? response.headers.get('retry-after') : null;
          if (retryAfter) {
            err.retryAfterSeconds = parseInt(retryAfter, 10) || 60;
          }
          throw err;
        }
        if (response.status >= 500) {
          const err = new Error(`Open-Meteo provider upstream error (${response.status}): ${errorText}`);
          err.code = 'PROVIDER_UNAVAILABLE';
          err.status = 503;
          throw err;
        }
        const err = new Error(`Open-Meteo request failed with status ${response.status}: ${errorText}`);
        err.code = 'PROVIDER_ERROR';
        err.status = response.status;
        throw err;
      }

      return await response.json();
    } catch (err) {
      if (err.name === 'AbortError' || err.code === 'ABORT_ERR') {
        const timeoutErr = new Error(`Open-Meteo provider timed out after ${timeout}ms.`);
        timeoutErr.code = 'PROVIDER_TIMEOUT';
        timeoutErr.status = 504;
        throw timeoutErr;
      }
      if (!err.code) {
        err.code = 'PROVIDER_UNAVAILABLE';
        err.status = 503;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Fetch complete combined weather dataset
   * @param {number} lat
   * @param {number} lon
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  async fetchComplete(lat, lon, options = {}) {
    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lon.toString(),
      current: [
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'is_day',
        'precipitation',
        'rain',
        'weather_code',
        'wind_speed_10m',
        'wind_direction_10m',
      ].join(','),
      hourly: [
        'temperature_2m',
        'relative_humidity_2m',
        'precipitation_probability',
        'precipitation',
        'weather_code',
        'wind_speed_10m',
      ].join(','),
      daily: [
        'weather_code',
        'temperature_2m_max',
        'temperature_2m_min',
        'precipitation_sum',
        'precipitation_probability_max',
        'wind_speed_10m_max',
      ].join(','),
      timezone: 'auto',
    });

    const url = `${this.baseUrl}?${params.toString()}`;
    const raw = await this._request(url, options);

    return {
      ...raw,
      latitude: lat,
      longitude: lon,
      source: this.getName(),
      sourceUpdateTime: raw.current?.time || new Date().toISOString(),
    };
  }

  /**
   * Fetch current weather
   * @param {number} lat
   * @param {number} lon
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  async fetchCurrent(lat, lon, options = {}) {
    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lon.toString(),
      current: [
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'is_day',
        'precipitation',
        'rain',
        'weather_code',
        'wind_speed_10m',
        'wind_direction_10m',
      ].join(','),
      timezone: 'auto',
    });

    const url = `${this.baseUrl}?${params.toString()}`;
    const raw = await this._request(url, options);

    return {
      ...raw,
      latitude: lat,
      longitude: lon,
      source: this.getName(),
      sourceUpdateTime: raw.current?.time || new Date().toISOString(),
    };
  }

  /**
   * Fetch hourly forecast
   * @param {number} lat
   * @param {number} lon
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  async fetchHourly(lat, lon, options = {}) {
    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lon.toString(),
      hourly: [
        'temperature_2m',
        'relative_humidity_2m',
        'precipitation_probability',
        'precipitation',
        'weather_code',
        'wind_speed_10m',
      ].join(','),
      timezone: 'auto',
    });

    const url = `${this.baseUrl}?${params.toString()}`;
    const raw = await this._request(url, options);

    return {
      ...raw,
      latitude: lat,
      longitude: lon,
      source: this.getName(),
    };
  }

  /**
   * Fetch daily forecast
   * @param {number} lat
   * @param {number} lon
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  async fetchDaily(lat, lon, options = {}) {
    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lon.toString(),
      daily: [
        'weather_code',
        'temperature_2m_max',
        'temperature_2m_min',
        'precipitation_sum',
        'precipitation_probability_max',
        'wind_speed_10m_max',
      ].join(','),
      timezone: 'auto',
    });

    const url = `${this.baseUrl}?${params.toString()}`;
    const raw = await this._request(url, options);

    return {
      ...raw,
      latitude: lat,
      longitude: lon,
      source: this.getName(),
    };
  }

  /**
   * Fetch weather warnings (queries complete meteorological profile and extracts threshold alerts)
   * @param {number} lat
   * @param {number} lon
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  async fetchWarnings(lat, lon, options = {}) {
    return await this.fetchComplete(lat, lon, options);
  }

  /**
   * Geocoding location search by name
   * @param {string} query
   * @param {Object} [options]
   * @returns {Promise<Array<Object>>}
   */
  async searchLocation(query, options = {}) {
    const params = new URLSearchParams({
      name: query.trim(),
      count: '5',
      language: 'en',
      format: 'json',
    });

    const url = `${this.geocodingUrl}?${params.toString()}`;
    const data = await this._request(url, options);

    const results = Array.isArray(data.results) ? data.results : [];
    return results.map((loc) => ({
      id: loc.id,
      name: loc.name,
      latitude: loc.latitude,
      longitude: loc.longitude,
      country: loc.country || '',
      countryCode: loc.country_code || '',
      admin1: loc.admin1 || '',
      timezone: loc.timezone || 'UTC',
      displayName: [loc.name, loc.admin1, loc.country].filter(Boolean).join(', '),
    }));
  }

  /**
   * Reverse geocode coordinates to human-readable place name
   * @param {number} lat
   * @param {number} lon
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  async reverseGeocode(lat, lon, options = {}) {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
    try {
      const data = await this._request(url, { ...options, timeout: 5000 });
      const locality = data.locality || data.city || data.principalSubdivision || '';
      const admin = data.principalSubdivision || '';
      const country = data.countryName || '';
      
      const displayName = [locality, admin, country]
        .filter((val, idx, arr) => Boolean(val) && arr.indexOf(val) === idx)
        .join(', ') || `Location (${lat.toFixed(2)}, ${lon.toFixed(2)})`;

      return {
        latitude: lat,
        longitude: lon,
        name: locality || admin || 'Local Area',
        locality,
        city: data.city || locality,
        admin1: admin,
        country,
        countryCode: data.countryCode || '',
        displayName,
      };
    } catch (err) {
      // Fallback to formatted coordinate sector if reverse geocode service is unreachable
      const fallbackName = `Sector (${Number(lat).toFixed(2)}, ${Number(lon).toFixed(2)})`;
      return {
        latitude: lat,
        longitude: lon,
        name: fallbackName,
        locality: fallbackName,
        city: '',
        admin1: '',
        country: '',
        displayName: fallbackName,
      };
    }
  }
}

module.exports = OpenMeteoProvider;
