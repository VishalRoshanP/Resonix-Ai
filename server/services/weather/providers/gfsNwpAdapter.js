/**
 * NOAA GFS (Global Forecast System) NWP Adapter
 * 
 * Ingests authentic Numerical Weather Prediction output from NOAA/NCEP GFS.
 * Model Characteristics:
 * - Operating Agency: National Oceanic and Atmospheric Administration (NOAA) / NCEP
 * - Dynamical Core: Finite-Volume Cubed-Sphere (FV3)
 * - Horizontal Resolution: 0.11° (~13 km) for GFS Seamless; 0.25° (~28 km) Global
 * - Run Cycles: 00z, 06z, 12z, 18z UTC
 * - Forecast Horizon: Up to 384 hours (16 days)
 */

const NwpProvider = require('./nwpProvider');
const logger = require('../../../utils/logger');

const GFS_API_URL = 'https://api.open-meteo.com/v1/gfs';
const DEFAULT_TIMEOUT_MS = 8000;

class GfsNwpAdapter extends NwpProvider {
  constructor(config = {}) {
    super('NOAA Global Forecast System (GFS)', 'gfs', config);
    this.apiUrl = config.apiUrl || GFS_API_URL;
    this.timeoutMs = config.timeoutMs || DEFAULT_TIMEOUT_MS;
    this.resolution = config.resolution || '0.11° (~13 km) / 0.25° (~28 km)';
    this.modelName = 'NOAA GFS (Global Forecast System)';
  }

  /**
   * Return standardized metadata for GFS NWP model
   */
  getModelMetadata() {
    return {
      source: 'NOAA / NCEP (National Centers for Environmental Prediction)',
      model: this.modelName,
      modelId: this.modelId,
      resolution: this.resolution,
      forecastHorizonHours: 384,
      runCycle: '4 times daily (00z, 06z, 12z, 18z UTC)',
      boundaryConditions: 'Global FV3 dynamical core with GSI data assimilation',
      updateTime: new Date().toISOString(),
    };
  }

  /**
   * Internal request helper with timeout and error handling
   * @private
   */
  async _request(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Resonix-AI/1.0 (NWP Meteorological Ingest)',
        },
      });
      clearTimeout(timer);

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`GFS NWP API returned status ${res.status}: ${errText}`);
      }

      return await res.json();
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        const timeoutErr = new Error(`GFS NWP request timed out after ${this.timeoutMs}ms.`);
        timeoutErr.code = 'PROVIDER_TIMEOUT';
        throw timeoutErr;
      }
      throw err;
    }
  }

  /**
   * Ingest actual GFS numerical prediction data
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @param {Object} [options] - Query options ({ days = 7, hours })
   * @returns {Promise<Object>}
   */
  async fetchNwpForecast(lat, lon, options = {}) {
    const days = Math.min(Math.max(Number(options.days) || 7, 1), 16);

    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lon.toString(),
      hourly: [
        'temperature_2m',
        'relative_humidity_2m',
        'precipitation',
        'rain',
        'wind_speed_10m',
        'wind_direction_10m',
        'surface_pressure',
        'weather_code',
      ].join(','),
      daily: [
        'temperature_2m_max',
        'temperature_2m_min',
        'precipitation_sum',
        'wind_speed_10m_max',
        'weather_code',
      ].join(','),
      models: 'gfs_seamless',
      forecast_days: days.toString(),
      timezone: 'auto',
    });

    const url = `${this.apiUrl}?${params.toString()}`;
    logger.info(`[GfsNwpAdapter] Ingesting NOAA GFS numerical model data for (${lat}, ${lon}) over ${days} days...`);

    const raw = await this._request(url);

    return {
      ...raw,
      latitude: lat,
      longitude: lon,
      modelMetadata: this.getModelMetadata(),
      source: this.getName(),
      sourceUpdateTime: raw.current?.time || raw.hourly?.time?.[0] || new Date().toISOString(),
    };
  }
}

module.exports = GfsNwpAdapter;
