/**
 * Probable Incident Area & Geographic Spread Service for RESONIX AI
 * 
 * Purpose:
 * Calculates the geographic distribution, cluster centroid, bounding box,
 * spread (meters), and Estimated Reporting Area (km²) for an Incident Fusion cluster.
 * 
 * Core Architectural & Terminology Rules:
 * - Deterministic JavaScript geographic calculations (Haversine & geodesic approximations).
 * - Gemma/LLM is NEVER asked to calculate GPS distances or areas.
 * - Does NOT claim to be the "Exact Damage Area" or "Confirmed Destruction Area".
 * - Labeled strictly as "Estimated Reporting Area" or "Probable Impact Area".
 * - Factors in real GPS accuracy tolerances (never pretends GPS is 100% exact).
 * - Returns "Insufficient reports to estimate area." if valid GPS reports < 2 (zero invention).
 * - Leaves original MongoDB incident records 100% unchanged.
 * - Strictly JavaScript (Node.js) — Zero TypeScript / Zero Python.
 */

const logger = require('../utils/logger');

class ClusterGeographicAreaService {
  /**
   * Deterministic Haversine distance in meters between two coordinates
   * @param {number} lat1
   * @param {number} lon1
   * @param {number} lat2
   * @param {number} lon2
   * @returns {number|null}
   */
  calculateDistanceMeters(lat1, lon1, lat2, lon2) {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
    const nLat1 = Number(lat1);
    const nLon1 = Number(lon1);
    const nLat2 = Number(lat2);
    const nLon2 = Number(lon2);
    if (isNaN(nLat1) || isNaN(nLon1) || isNaN(nLat2) || isNaN(nLon2)) return null;

    const R = 6371e3; // Earth radius in meters
    const φ1 = (nLat1 * Math.PI) / 180;
    const φ2 = (nLat2 * Math.PI) / 180;
    const Δφ = ((nLat2 - nLat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
  }

  /**
   * Extracts latitude, longitude, and accuracy from an incident or packet record
   * @param {Object} item
   * @returns {{lat: number|null, lng: number|null, accuracyMeters: number|null}}
   */
  extractGpsPoint(item) {
    if (!item || typeof item !== 'object') {
      return { lat: null, lng: null, accuracyMeters: null };
    }

    let lat = null;
    let lng = null;
    let accuracyMeters = null;

    if (item.location && typeof item.location === 'object') {
      if (item.location.lat != null && item.location.lat !== '') lat = Number(item.location.lat);
      else if (item.location.latitude != null && item.location.latitude !== '') lat = Number(item.location.latitude);

      if (item.location.lng != null && item.location.lng !== '') lng = Number(item.location.lng);
      else if (item.location.longitude != null && item.location.longitude !== '') lng = Number(item.location.longitude);

      if (item.location.accuracy != null && item.location.accuracy !== '') accuracyMeters = Number(item.location.accuracy);
    }

    if ((lat === null || lng === null) && item.gpsCoordinates && typeof item.gpsCoordinates === 'object') {
      if (item.gpsCoordinates.latitude != null && item.gpsCoordinates.latitude !== '') lat = Number(item.gpsCoordinates.latitude);
      else if (item.gpsCoordinates.lat != null && item.gpsCoordinates.lat !== '') lat = Number(item.gpsCoordinates.lat);

      if (item.gpsCoordinates.longitude != null && item.gpsCoordinates.longitude !== '') lng = Number(item.gpsCoordinates.longitude);
      else if (item.gpsCoordinates.lng != null && item.gpsCoordinates.lng !== '') lng = Number(item.gpsCoordinates.lng);

      if (accuracyMeters === null && item.gpsCoordinates.accuracy != null && item.gpsCoordinates.accuracy !== '') accuracyMeters = Number(item.gpsCoordinates.accuracy);
      if (accuracyMeters === null && item.gpsCoordinates.accuracyMeters != null && item.gpsCoordinates.accuracyMeters !== '') accuracyMeters = Number(item.gpsCoordinates.accuracyMeters);
    }

    if (lat === null && item.latitude != null && item.latitude !== '') lat = Number(item.latitude);
    if (lng === null && item.longitude != null && item.longitude !== '') lng = Number(item.longitude);
    if (accuracyMeters === null && item.accuracy != null && item.accuracy !== '') accuracyMeters = Number(item.accuracy);
    if (accuracyMeters === null && item.accuracyMeters != null && item.accuracyMeters !== '') accuracyMeters = Number(item.accuracyMeters);

    if (lat === null || lng === null) {
      const coords = Array.isArray(item.coordinates)
        ? item.coordinates
        : (Array.isArray(item.location?.coordinates) ? item.location.coordinates : null);
      if (coords && coords.length >= 2 && coords[0] != null && coords[1] != null && coords[0] !== '' && coords[1] !== '') {
        lng = Number(coords[0]);
        lat = Number(coords[1]);
      }
    }

    const isValidLat = typeof lat === 'number' && !isNaN(lat) && isFinite(lat) && lat >= -90 && lat <= 90;
    const isValidLng = typeof lng === 'number' && !isNaN(lng) && isFinite(lng) && lng >= -180 && lng <= 180;
    if (!isValidLat || !isValidLng || (lat === 0 && lng === 0)) {
      lat = null;
      lng = null;
    }
    if (accuracyMeters != null && (isNaN(accuracyMeters) || !isFinite(accuracyMeters))) {
      accuracyMeters = null;
    }

    return { lat, lng, accuracyMeters };
  }

  /**
   * Calculates the Probable Incident Area / Estimated Reporting Area for an incident cluster
   * 
   * @param {Array<Object>|Object} input - Array of incident reports or cluster object
   * @param {Object} [options] - Configuration options { bufferMeters }
   * @returns {Object} Structured reporting area analysis
   */
  calculateProbableIncidentArea(input, options = {}) {
    const reports = Array.isArray(input)
      ? input
      : (Array.isArray(input?.incidents) ? input.incidents : (input ? [input] : []));

    // Extract all valid GPS points
    const validPoints = [];
    const accuracyValues = [];

    reports.forEach((r) => {
      const pt = this.extractGpsPoint(r);
      if (pt.lat !== null && pt.lng !== null && !isNaN(pt.lat) && !isNaN(pt.lng)) {
        validPoints.push(pt);
        if (pt.accuracyMeters != null && pt.accuracyMeters > 0) {
          accuracyValues.push(pt.accuracyMeters);
        }
      }
    });

    const reportCount = validPoints.length;

    // Minimum 2 GPS-tagged reports required to calculate spread and area
    if (reportCount < 2) {
      const singleCenter = reportCount === 1
        ? { lat: Number(validPoints[0].lat.toFixed(6)), lng: Number(validPoints[0].lng.toFixed(6)) }
        : null;

      logger.info(`[ClusterGeographicArea] Insufficient reports (${reportCount} valid GPS points) to calculate reporting area.`);

      return {
        status: 'INSUFFICIENT_DATA',
        message: 'Insufficient reports to estimate area.',
        areaLabel: 'Insufficient reports to estimate area.',
        validGpsReportsCount: reportCount,
        center: singleCenter,
        spreadMeters: null,
        estimatedReportingAreaKm2: null,
        confidence: 'LOW',
        boundingBox: null,
        gpsAccuracy: {
          averageAccuracyMeters: accuracyValues.length > 0 ? Math.round(accuracyValues.reduce((a, b) => a + b, 0) / accuracyValues.length) : null,
          hasGpsAccuracyData: accuracyValues.length > 0,
        },
      };
    }

    // 1. Calculate Geographic Center (Centroid)
    let sumLat = 0;
    let sumLng = 0;
    let minLat = validPoints[0].lat;
    let maxLat = validPoints[0].lat;
    let minLng = validPoints[0].lng;
    let maxLng = validPoints[0].lng;

    validPoints.forEach((pt) => {
      sumLat += pt.lat;
      sumLng += pt.lng;
      if (pt.lat < minLat) minLat = pt.lat;
      if (pt.lat > maxLat) maxLat = pt.lat;
      if (pt.lng < minLng) minLng = pt.lng;
      if (pt.lng > maxLng) maxLng = pt.lng;
    });

    const centerLat = Number((sumLat / reportCount).toFixed(6));
    const centerLng = Number((sumLng / reportCount).toFixed(6));

    // 2. Calculate Maximum Pairwise Geographic Spread (meters)
    let maxSpreadMeters = 0;
    for (let i = 0; i < validPoints.length; i++) {
      for (let j = i + 1; j < validPoints.length; j++) {
        const dist = this.calculateDistanceMeters(
          validPoints[i].lat,
          validPoints[i].lng,
          validPoints[j].lat,
          validPoints[j].lng
        );
        if (dist != null && dist > maxSpreadMeters) {
          maxSpreadMeters = dist;
        }
      }
    }

    // 3. GPS Accuracy Considerations
    let avgAccuracyMeters = 15; // Standard fallback civilian mobile GPS accuracy (~15m)
    if (accuracyValues.length > 0) {
      avgAccuracyMeters = Math.round(accuracyValues.reduce((a, b) => a + b, 0) / accuracyValues.length);
    }

    // 4. Calculate Approximate Reporting Area (in km²)
    // Effective radius incorporates the cluster spread radius plus the average GPS sensor margin
    const clusterRadiusMeters = Math.max(15, maxSpreadMeters / 2);
    const effectiveRadiusMeters = clusterRadiusMeters + avgAccuracyMeters;
    
    // Circular buffered reporting area: Area = π * r² in m² -> convert to km²
    const areaM2 = Math.PI * Math.pow(effectiveRadiusMeters, 2);
    const areaKm2 = Number((areaM2 / 1e6).toFixed(4));

    // 5. Confidence Assessment based on report density and GPS accuracy
    let confidence = 'MEDIUM';
    if (reportCount >= 5 && avgAccuracyMeters <= 20) {
      confidence = 'HIGH';
    } else if (reportCount < 3 || avgAccuracyMeters > 50) {
      confidence = 'LOW';
    } else {
      confidence = 'MEDIUM';
    }

    logger.info(`[ClusterGeographicArea] Estimated Reporting Area: ${areaKm2} km² (Spread: ${maxSpreadMeters}m, Points: ${reportCount}, Confidence: ${confidence})`);

    return {
      center: {
        lat: centerLat,
        lng: centerLng,
      },
      spreadMeters: maxSpreadMeters,
      radiusMeters: Math.round(effectiveRadiusMeters),
      estimatedReportingAreaKm2: areaKm2,
      confidence,
      terminology: 'Estimated Reporting Area',
      areaLabel: `Estimated Reporting Area: ${areaKm2} km² (${maxSpreadMeters} m spread across ${reportCount} reports)`,
      validGpsReportsCount: reportCount,
      boundingBox: {
        minLatitude: Number(minLat.toFixed(6)),
        maxLatitude: Number(maxLat.toFixed(6)),
        minLongitude: Number(minLng.toFixed(6)),
        maxLongitude: Number(maxLng.toFixed(6)),
      },
      gpsAccuracy: {
        averageAccuracyMeters: avgAccuracyMeters,
        toleranceIncluded: true,
      },
    };
  }
}

const clusterGeographicAreaService = new ClusterGeographicAreaService();

module.exports = clusterGeographicAreaService;
module.exports.ClusterGeographicAreaService = ClusterGeographicAreaService;
