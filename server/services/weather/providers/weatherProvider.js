/**
 * WeatherProvider Abstract Base Interface
 * 
 * Defines the contract that all concrete weather providers must implement.
 * Ensures the Resonix AI weather subsystem remains completely provider-independent.
 */
class WeatherProvider {
  /**
   * @param {string} name - Unique provider identifier
   * @param {Object} [config] - Provider-specific configuration options
   */
  constructor(name, config = {}) {
    if (new.target === WeatherProvider) {
      throw new TypeError('Cannot construct WeatherProvider instances directly. Subclass must implement abstract methods.');
    }
    this.name = name;
    this.config = config;
  }

  /**
   * Return human-readable provider name
   * @returns {string}
   */
  getName() {
    return this.name;
  }

  /**
   * Fetch current weather conditions for given coordinates
   * @param {number} lat - Latitude (-90 to 90)
   * @param {number} lon - Longitude (-180 to 180)
   * @param {Object} [options]
   * @returns {Promise<Object>} Raw provider payload
   */
  async fetchCurrent(lat, lon, options = {}) {
    throw new Error(`fetchCurrent() not implemented by provider: ${this.name}`);
  }

  /**
   * Fetch hourly forecast for given coordinates
   * @param {number} lat - Latitude (-90 to 90)
   * @param {number} lon - Longitude (-180 to 180)
   * @param {Object} [options]
   * @returns {Promise<Object>} Raw provider payload
   */
  async fetchHourly(lat, lon, options = {}) {
    throw new Error(`fetchHourly() not implemented by provider: ${this.name}`);
  }

  /**
   * Fetch daily forecast for given coordinates
   * @param {number} lat - Latitude (-90 to 90)
   * @param {number} lon - Longitude (-180 to 180)
   * @param {Object} [options]
   * @returns {Promise<Object>} Raw provider payload
   */
  async fetchDaily(lat, lon, options = {}) {
    throw new Error(`fetchDaily() not implemented by provider: ${this.name}`);
  }

  /**
   * Fetch severe weather warnings/alerts for given coordinates
   * @param {number} lat - Latitude (-90 to 90)
   * @param {number} lon - Longitude (-180 to 180)
   * @param {Object} [options]
   * @returns {Promise<Object>} Raw provider payload
   */
  async fetchWarnings(lat, lon, options = {}) {
    throw new Error(`fetchWarnings() not implemented by provider: ${this.name}`);
  }

  /**
   * Fetch complete combined weather bundle (current, hourly, daily, warnings)
   * @param {number} lat - Latitude (-90 to 90)
   * @param {number} lon - Longitude (-180 to 180)
   * @param {Object} [options]
   * @returns {Promise<Object>} Raw provider payload
   */
  async fetchComplete(lat, lon, options = {}) {
    throw new Error(`fetchComplete() not implemented by provider: ${this.name}`);
  }

  /**
   * Search locations by query string (geocoding lookup)
   * @param {string} query - Location name or postal code
   * @param {Object} [options]
   * @returns {Promise<Array<Object>>} List of location candidates
   */
  async searchLocation(query, options = {}) {
    throw new Error(`searchLocation() not implemented by provider: ${this.name}`);
  }

  /**
   * Reverse geocode coordinates to human-readable place name
   * @param {number} lat - Latitude (-90 to 90)
   * @param {number} lon - Longitude (-180 to 180)
   * @param {Object} [options]
   * @returns {Promise<Object>} Formatted location name and components
   */
  async reverseGeocode(lat, lon, options = {}) {
    throw new Error(`reverseGeocode() not implemented by provider: ${this.name}`);
  }
}

module.exports = WeatherProvider;
