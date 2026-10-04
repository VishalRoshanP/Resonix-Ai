/**
 * Weather Validator
 * 
 * Enforces strict meteorological sanity boundaries, valid geographical coordinates,
 * and structural integrity on weather queries and provider responses.
 */

const ApiError = require('../../utils/apiError');

/**
 * Validates geographical coordinates
 * @param {number|string} lat
 * @param {number|string} lon
 * @returns {{ lat: number, lon: number }} Parsed valid numbers
 * @throws {ApiError} If invalid
 */
function validateCoordinates(lat, lon) {
  if (lat === undefined || lat === null || lat === '') {
    throw new ApiError(400, 'Latitude parameter (lat) is required.');
  }
  if (lon === undefined || lon === null || lon === '') {
    throw new ApiError(400, 'Longitude parameter (lon) is required.');
  }

  const parsedLat = Number(lat);
  const parsedLon = Number(lon);

  if (isNaN(parsedLat) || !isFinite(parsedLat)) {
    throw new ApiError(400, `Invalid latitude value: '${lat}'. Must be a valid floating-point number.`);
  }
  if (isNaN(parsedLon) || !isFinite(parsedLon)) {
    throw new ApiError(400, `Invalid longitude value: '${lon}'. Must be a valid floating-point number.`);
  }

  if (parsedLat < -90 || parsedLat > 90) {
    throw new ApiError(400, `Latitude out of range: ${parsedLat}. Must be between -90.0 and 90.0 degrees.`);
  }
  if (parsedLon < -180 || parsedLon > 180) {
    throw new ApiError(400, `Longitude out of range: ${parsedLon}. Must be between -180.0 and 180.0 degrees.`);
  }

  return { lat: parsedLat, lon: parsedLon };
}

/**
 * Validates location search query string
 * @param {string} query
 * @returns {string} Sanitized query
 * @throws {ApiError} If invalid
 */
function validateLocationQuery(query) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    throw new ApiError(400, 'Location search query parameter (q) is required.');
  }
  const clean = query.trim();
  if (clean.length < 2) {
    throw new ApiError(400, 'Location search query must contain at least 2 characters.');
  }
  if (clean.length > 100) {
    throw new ApiError(400, 'Location search query exceeds maximum length of 100 characters.');
  }
  return clean;
}

/**
 * Validates normalized weather response integrity and numerical boundaries
 * @param {Object} normalized
 * @returns {boolean}
 * @throws {ApiError} If structurally corrupted
 */
function validateWeatherResponse(normalized) {
  if (!normalized || typeof normalized !== 'object') {
    throw new ApiError(502, 'Weather provider returned empty or malformed data.');
  }

  const { current, location } = normalized;
  if (!current || typeof current !== 'object') {
    throw new ApiError(502, 'Weather payload missing current meteorological conditions.');
  }

  // Physical sanity boundaries
  if (current.temperature !== null) {
    if (current.temperature < -90 || current.temperature > 65) {
      throw new ApiError(502, `Meteorological sanity check failed: Temperature ${current.temperature}°C is outside realistic Earth limits (-90°C to +65°C).`);
    }
  }

  if (current.humidity !== null) {
    if (current.humidity < 0 || current.humidity > 100) {
      throw new ApiError(502, `Meteorological sanity check failed: Relative humidity ${current.humidity}% must be between 0% and 100%.`);
    }
  }

  if (current.windSpeed !== null && current.windSpeed < 0) {
    throw new ApiError(502, `Meteorological sanity check failed: Wind velocity ${current.windSpeed} km/h cannot be negative.`);
  }

  if (current.precipitation !== null && current.precipitation < 0) {
    throw new ApiError(502, `Meteorological sanity check failed: Precipitation ${current.precipitation} mm cannot be negative.`);
  }

  if (current.pressure !== null && current.pressure !== undefined) {
    if (current.pressure < 800 || current.pressure > 1150) {
      throw new ApiError(502, `Meteorological sanity check failed: Surface pressure ${current.pressure} hPa is outside Earth limits (800 to 1150 hPa).`);
    }
  }

  if (current.uvIndex !== null && current.uvIndex !== undefined) {
    if (current.uvIndex < 0 || current.uvIndex > 30) {
      throw new ApiError(502, `Meteorological sanity check failed: UV Index ${current.uvIndex} is outside realistic boundaries (0 to 30).`);
    }
  }

  return true;
}

module.exports = {
  validateCoordinates,
  validateLocationQuery,
  validateWeatherResponse,
};
