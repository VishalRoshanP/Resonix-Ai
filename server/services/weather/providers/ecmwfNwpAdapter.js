/**
 * ECMWF IFS (Integrated Forecasting System) NWP Adapter
 * 
 * Ingests authentic Numerical Weather Prediction output from ECMWF.
 * Model Characteristics:
 * - Operating Agency: European Centre for Medium-Range Weather Forecasts (ECMWF)
 * - Dynamical Core: Spectral transform semi-Lagrangian (IFS)
 * - Horizontal Resolution: 0.25° (~25 km)
 * - Run Cycles: 00z, 12z UTC
 * - Forecast Horizon: Up to 240 hours (10 days)
 */

const NwpProvider = require('./nwpProvider');
const logger = require('../../../utils/logger');

const ECMWF_API_URL = 'https://api.open-meteo.com/v1/forecast';
const DEFAULT_TIMEOUT_MS = 8000;

class EcmwfNwpAdapter extends NwpProvider {
  constructor(config = {}) {
    super('ECMWF Integrated Forecasting System (IFS)', 'ecmwf', config);
    this.apiUrl = config.apiUrl || ECMWF_API_URL;
    this.timeoutMs = config.timeoutMs || DEFAULT_TIMEOUT_MS;
    this.resolution = config.resolution || '0.25° (~25 km)';
    this.modelName = 'ECMWF IFS (0.25°)';
  }

  /**
   * Return standardized metadata for ECMWF NWP model
   */
  getModelMetadata() {
    return {
      source: 'European Centre for Medium-Range Weather Forecasts (ECMWF)',
      model: this.modelName,
      modelId: this.modelId,
      resolution: this.resolution,
      forecastHorizonHours: 240,
      runCycle: '2 times daily (00z, 12z UTC)',
      boundaryConditions: 'Global IFS non-hydrostatic dynamical formulation with 4D-Var assimilation',
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
          'User-Agent': 'Resonix-AI/1.0 (ECMWF Ingest)',
        },
      });
      clearTimeout(timer);

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`ECMWF NWP API returned status ${res.status}: ${errText}`);
      }

      return await res.json();
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        const timeoutErr = new Error(`ECMWF NWP request timed out after ${this.timeoutMs}ms.`);
        timeoutErr.code = 'PROVIDER_TIMEOUT';
        throw timeoutErr;
      }
      throw err;
    }
  }

  /**
   * Ingest actual ECMWF numerical prediction data
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @param {Object} [options] - Query options ({ days = 7 })
   * @returns {Promise<Object>}
   */
  async fetchNwpForecast(lat, lon, options = {}) {
    const days = Math.min(Math.max(Number(options.days) || 7, 1), 10);

    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lon.toString(),
      hourly: [
        'temperature_2m',
        'relative_humidity_2m',
        'precipitation',
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
      models: 'ecmwf_ifs025',
      forecast_days: days.toString(),
      timezone: 'auto',
    });

    const url = `${this.apiUrl}?${params.toString()}`;
    logger.info(`[EcmwfNwpAdapter] Ingesting ECMWF IFS numerical model data for (${lat}, ${lon}) over ${days} days...`);

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

module.exports = EcmwfNwpAdapter;
