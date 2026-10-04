/**
 * Weather Query Validations
 */

const ApiError = require('../utils/apiError');
const { validateCoordinates, validateLocationQuery } = require('../services/weather/weatherValidator');

/**
 * Middleware to validate weather coordinate query parameters (lat, lon)
 */
const validateCoordinateParams = (req, res, next) => {
  try {
    const { lat, lon } = req.query;
    const validated = validateCoordinates(lat, lon);
    req.validatedCoordinates = validated;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Middleware to validate location search query parameter (q)
 */
const validateLookupParams = (req, res, next) => {
  try {
    const { q } = req.query;
    const validated = validateLocationQuery(q);
    req.validatedQuery = validated;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Middleware to validate conversational weather question parameters
 */
const validateAskParams = (req, res, next) => {
  try {
    const query = req.body?.query || req.query?.q;
    if (!query || typeof query !== 'string' || !query.trim()) {
      throw new ApiError(400, "Query string is required (e.g. 'weather near me', 'will it rain here tomorrow?').");
    }

    const lat = req.body?.lat ?? req.query?.lat ?? 12.9716;
    const lon = req.body?.lon ?? req.query?.lon ?? 77.5946;
    const validatedCoords = validateCoordinates(lat, lon);

    req.validatedAsk = {
      query: query.trim(),
      lat: validatedCoords.lat,
      lon: validatedCoords.lon,
      locationName: req.body?.locationName || req.query?.locationName,
      city: req.body?.city || req.query?.city,
      state: req.body?.state || req.query?.state,
      country: req.body?.country || req.query?.country,
      language: req.body?.language || req.query?.language || req.body?.lang || req.query?.lang,
    };
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = {
  validateCoordinateParams,
  validateLookupParams,
  validateAskParams,
};
