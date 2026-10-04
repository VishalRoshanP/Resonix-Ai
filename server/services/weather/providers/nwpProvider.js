/**
 * NwpProvider Abstract Base Interface
 * 
 * Extends WeatherProvider specifically for Numerical Weather Prediction (NWP) models
 * such as NOAA GFS (Global Forecast System), ECMWF IFS, and WRF-derived mesoscale models.
 * 
 * Guarantees standard NWP contracts:
 * - Model identification and metadata (source, resolution, run cycle, forecast horizon)
 * - Actual numerical forecast ingestion (temperature, precipitation, wind, humidity, pressure)
 * - Model boundary conditions and physical parameterization tracking
 */

const WeatherProvider = require('./weatherProvider');

class NwpProvider extends WeatherProvider {
  /**
   * @param {string} name - Human-readable provider/model name
   * @param {string} modelId - Normalized identifier (e.g. 'gfs', 'ecmwf_ifs025', 'wrf')
   * @param {Object} [config] - Model-specific configuration options
   */
  constructor(name, modelId, config = {}) {
    if (new.target === NwpProvider) {
      throw new TypeError('Cannot construct NwpProvider instances directly. Subclass must implement abstract methods.');
    }
    super(name, config);
    this.modelId = modelId;
  }

  /**
   * Return standardized model ID
   * @returns {string}
   */
  getModelId() {
    if (!this.modelId) {
      throw new Error(`getModelId() must be implemented by subclass for: ${this.name}`);
    }
    return this.modelId;
  }

  /**
   * Return comprehensive model metadata
   * @returns {Object} { source, model, modelId, resolution, forecastHorizonHours, runCycle, updateTime, boundaryConditions }
   */
  getModelMetadata() {
    throw new Error(`getModelMetadata() not implemented by NWP provider: ${this.name}`);
  }

  /**
   * Ingest raw NWP numerical forecast
   * @param {number} lat - Latitude (-90 to 90)
   * @param {number} lon - Longitude (-180 to 180)
   * @param {Object} [options] - Query options ({ hours, days, forecastHorizon })
   * @returns {Promise<Object>} Raw NWP model output
   */
  async fetchNwpForecast(lat, lon, options = {}) {
    throw new Error(`fetchNwpForecast() not implemented by NWP provider: ${this.name}`);
  }

  /**
   * WeatherProvider compliance: fetchHourly maps to fetchNwpForecast
   */
  async fetchHourly(lat, lon, options = {}) {
    return this.fetchNwpForecast(lat, lon, options);
  }

  /**
   * WeatherProvider compliance: fetchComplete returns NWP dataset
   */
  async fetchComplete(lat, lon, options = {}) {
    return this.fetchNwpForecast(lat, lon, options);
  }
}

module.exports = NwpProvider;
