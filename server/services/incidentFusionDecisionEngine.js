/**
 * Multi-Citizen Incident Fusion Decision Engine for RESONIX AI
 * 
 * Purpose:
 * Combines geographic distance, semantic similarity, time proximity, emergency category,
 * and severity into a reusable Incident Fusion analysis service.
 * 
 * Multi-Signal Decision Rule:
 * A report pair/cluster is considered a fusion candidate ONLY when multiple independent signals agree:
 * 1. Geographic Proximity (Deterministic Haversine distance <= threshold)
 * 2. Semantic Similarity (Dense vector cosine similarity >= threshold)
 * 3. Temporal Proximity (Timestamp delta <= threshold)
 * 4. Hazard / Category Compatibility (Compatible disaster domains)
 * 
 * Strict Constraint: Do NOT use only one signal. All necessary multi-signals must align.
 * 
 * Architectural Safety Principles:
 * - Does NOT create incidents.
 * - Does NOT mutate or merge MongoDB documents.
 * - Does NOT delete or overwrite citizen reports.
 * - Produces purely an analytical view/decision structure over real incidents.
 * - Strictly JavaScript (Node.js) — Zero TypeScript / Zero Python.
 */

const incidentSimilarityService = require('./incidentSimilarityService');
const pineconeConfig = require('../config/pinecone');
const logger = require('../utils/logger');

class IncidentFusionDecisionEngine {
  constructor(config = {}) {
    this.similarityService = incidentSimilarityService;
    this.defaults = {
      maxDistanceMeters: parseInt(process.env.INCIDENT_CLUSTER_RADIUS_METERS || process.env.FUSION_MAX_DISTANCE_METERS, 10) || 500, // 500 meters default
      maxTimeDeltaMinutes: parseInt(process.env.INCIDENT_CLUSTER_TIME_WINDOW_MINUTES || process.env.FUSION_MAX_TIME_MINUTES, 10) || 180, // 180 minutes default (3 hours)
      minSemanticSimilarity: parseFloat(process.env.INCIDENT_SIMILARITY_THRESHOLD) || pineconeConfig.incidentSimilarityThreshold || 0.50,
      minFusionConfidence: parseFloat(process.env.FUSION_CONFIDENCE_THRESHOLD) || 0.70,
      ...config,
    };

    // Disaster Hazard Compatibility Matrix (Supports all 8 canonical disaster types)
    this.hazardCompatibilityMap = {
      FIRE: new Set(['FIRE', 'EXPLOSION', 'HAZMAT', 'BUILDING_COLLAPSE', 'INFRASTRUCTURE_DAMAGE', 'ROAD_BLOCKAGE', 'GENERAL', 'GENERAL_EMERGENCY', 'OTHER']),
      FLOOD: new Set(['FLOOD', 'CYCLONE', 'STORM', 'LANDSLIDE', 'WATER_LOGGING', 'ROAD_BLOCKAGE', 'ROAD_BLOCK', 'INFRASTRUCTURE_DAMAGE', 'GENERAL', 'GENERAL_EMERGENCY', 'OTHER']),
      EARTHQUAKE: new Set(['EARTHQUAKE', 'BUILDING_COLLAPSE', 'LANDSLIDE', 'INFRASTRUCTURE_DAMAGE', 'ROAD_BLOCKAGE', 'GENERAL', 'GENERAL_EMERGENCY', 'OTHER']),
      CYCLONE: new Set(['CYCLONE', 'FLOOD', 'STORM', 'ROAD_BLOCKAGE', 'ROAD_BLOCK', 'INFRASTRUCTURE_DAMAGE', 'GENERAL', 'GENERAL_EMERGENCY', 'OTHER']),
      LANDSLIDE: new Set(['LANDSLIDE', 'FLOOD', 'EARTHQUAKE', 'ROAD_BLOCKAGE', 'ROAD_BLOCK', 'INFRASTRUCTURE_DAMAGE', 'GENERAL', 'GENERAL_EMERGENCY', 'OTHER']),
      ROAD_BLOCKAGE: new Set(['ROAD_BLOCKAGE', 'ROAD_BLOCK', 'FLOOD', 'CYCLONE', 'STORM', 'LANDSLIDE', 'INFRASTRUCTURE_DAMAGE', 'ACCIDENT', 'TRAFFIC_COLLISION', 'GENERAL', 'GENERAL_EMERGENCY', 'OTHER']),
      INFRASTRUCTURE_DAMAGE: new Set(['INFRASTRUCTURE_DAMAGE', 'BUILDING_COLLAPSE', 'COLLAPSE', 'FLOOD', 'CYCLONE', 'LANDSLIDE', 'FIRE', 'EARTHQUAKE', 'ROAD_BLOCKAGE', 'GENERAL', 'GENERAL_EMERGENCY', 'OTHER']),
      BUILDING_COLLAPSE: new Set(['BUILDING_COLLAPSE', 'INFRASTRUCTURE_DAMAGE', 'EARTHQUAKE', 'FIRE', 'EXPLOSION', 'ROAD_BLOCKAGE', 'GENERAL', 'GENERAL_EMERGENCY', 'OTHER']),
      ACCIDENT: new Set(['ACCIDENT', 'MEDICAL', 'MEDICAL_EMERGENCY', 'ROAD_BLOCKAGE', 'TRAFFIC_COLLISION', 'GENERAL', 'GENERAL_EMERGENCY', 'OTHER']),
      MEDICAL: new Set(['MEDICAL', 'MEDICAL_EMERGENCY', 'ACCIDENT', 'FLOOD', 'FIRE', 'CYCLONE', 'LANDSLIDE', 'BUILDING_COLLAPSE', 'GENERAL', 'GENERAL_EMERGENCY', 'OTHER']),
      MEDICAL_EMERGENCY: new Set(['MEDICAL', 'MEDICAL_EMERGENCY', 'ACCIDENT', 'FLOOD', 'FIRE', 'CYCLONE', 'LANDSLIDE', 'BUILDING_COLLAPSE', 'GENERAL', 'GENERAL_EMERGENCY', 'OTHER']),
      HAZMAT: new Set(['HAZMAT', 'FIRE', 'CHEMICAL_LEAK', 'INFRASTRUCTURE_DAMAGE', 'GENERAL', 'GENERAL_EMERGENCY', 'OTHER']),
      GENERAL: new Set(['*']), // Wildcard matches all
      GENERAL_EMERGENCY: new Set(['*']),
      OTHER: new Set(['*']),
    };
  }

  /**
   * Deterministic Haversine distance calculation in meters between two GPS coordinate pairs
   * @param {number} lat1
   * @param {number} lon1
   * @param {number} lat2
   * @param {number} lon2
   * @returns {number|null} Distance in meters
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
   * Extracts latitude & longitude from Incident document, EmergencyPacket, or raw object
   * @param {Object} item
   * @returns {{lat: number|null, lng: number|null}}
   */
  extractCoordinates(item) {
    if (!item || typeof item !== 'object') return { lat: null, lng: null };

    let lat = null;
    let lng = null;

    if (item.location && typeof item.location === 'object') {
      if (item.location.lat != null && item.location.lat !== '') lat = Number(item.location.lat);
      else if (item.location.latitude != null && item.location.latitude !== '') lat = Number(item.location.latitude);

      if (item.location.lng != null && item.location.lng !== '') lng = Number(item.location.lng);
      else if (item.location.longitude != null && item.location.longitude !== '') lng = Number(item.location.longitude);
    }

    if ((lat == null || lng == null) && item.gpsCoordinates && typeof item.gpsCoordinates === 'object') {
      if (item.gpsCoordinates.latitude != null && item.gpsCoordinates.latitude !== '') lat = Number(item.gpsCoordinates.latitude);
      else if (item.gpsCoordinates.lat != null && item.gpsCoordinates.lat !== '') lat = Number(item.gpsCoordinates.lat);

      if (item.gpsCoordinates.longitude != null && item.gpsCoordinates.longitude !== '') lng = Number(item.gpsCoordinates.longitude);
      else if (item.gpsCoordinates.lng != null && item.gpsCoordinates.lng !== '') lng = Number(item.gpsCoordinates.lng);
    }

    if (lat == null && item.latitude != null && item.latitude !== '') lat = Number(item.latitude);
    if (lng == null && item.longitude != null && item.longitude !== '') lng = Number(item.longitude);

    if (lat == null || lng == null) {
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
    if (isValidLat && isValidLng && (lat !== 0 || lng !== 0)) {
      return { lat, lng };
    }

    return { lat: null, lng: null };
  }

  /**
   * Extracts timestamp from Incident or Packet
   * @param {Object} item
   * @returns {Date}
   */
  extractTimestamp(item) {
    if (!item) return new Date();
    const raw = item.createdAt || item.timestamp || item.receivedAt || item.time;
    if (raw) {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  }

  /**
   * Extracts category code in uppercase with underscores
   * @param {Object|string} item
   * @returns {string}
   */
  extractCategory(item) {
    if (!item) return 'GENERAL';
    if (typeof item === 'string') return item.trim().toUpperCase().replace(/[\s-]+/g, '_');
    const cat = item.detectedCategory || item.detectedEmergencyCategory || item.category || item.disasterCategory || item.aiAssessment?.category || item.selectedCategory || item.citizenSelectedCategory || item.type || item.citizenInput?.selectedCategory || 'GENERAL';
    return String(cat).trim().toUpperCase().replace(/[\s-]+/g, '_');
  }

  /**
   * Formats category code into canonical user-facing label
   * @param {string} cat
   * @returns {string}
   */
  formatCanonicalCategory(cat) {
    if (!cat) return 'Other';
    const normalized = String(cat).trim().toUpperCase().replace(/[\s-]+/g, '_');
    const map = {
      FLOOD: 'Flood',
      FIRE: 'Fire',
      CYCLONE: 'Cyclone',
      LANDSLIDE: 'Landslide',
      ROAD_BLOCKAGE: 'Road blockage',
      ROAD_BLOCK: 'Road blockage',
      MEDICAL_EMERGENCY: 'Medical emergency',
      MEDICAL: 'Medical emergency',
      INFRASTRUCTURE_DAMAGE: 'Infrastructure damage',
      BUILDING_COLLAPSE: 'Infrastructure damage',
      EARTHQUAKE: 'Earthquake',
      ACCIDENT: 'Accident',
      HAZMAT: 'Hazmat',
      OTHER: 'Other',
      GENERAL: 'Other',
      GENERAL_EMERGENCY: 'Other',
    };
    return map[normalized] || (String(cat).charAt(0).toUpperCase() + String(cat).slice(1));
  }

  /**
   * Evaluates hazard compatibility between two disaster categories
   * @param {string} catA
   * @param {string} catB
   * @returns {boolean}
   */
  isHazardCompatible(catA, catB) {
    const a = (catA || 'GENERAL').toUpperCase().replace(/[\s-]+/g, '_');
    const b = (catB || 'GENERAL').toUpperCase().replace(/[\s-]+/g, '_');

    if (a === b) return true;
    if (['GENERAL', 'GENERAL_EMERGENCY', 'OTHER'].includes(a) || ['GENERAL', 'GENERAL_EMERGENCY', 'OTHER'].includes(b)) {
      return true;
    }

    const setA = this.hazardCompatibilityMap[a];
    if (setA && (setA.has(b) || setA.has('*'))) return true;

    const setB = this.hazardCompatibilityMap[b];
    if (setB && (setB.has(a) || setB.has('*'))) return true;

    return false;
  }

  /**
   * Evaluates whether two incident reports/documents are likely related using multi-signal agreement
   * 
   * @param {Object|string} reportA - Incident A
   * @param {Object|string} reportB - Incident B
   * @param {Object} [options] - Optional custom thresholds { maxDistanceMeters, maxTimeDeltaMinutes, minSemanticSimilarity, minConfidence, semanticSimilarity }
   * @returns {Object} Structured decision assessment
   */
  evaluatePair(reportA, reportB, options = {}) {
    const maxDistanceMeters = options.clusterRadiusMeters ?? options.maxDistanceMeters ?? options.radiusMeters ?? this.defaults.maxDistanceMeters;
    const maxTimeDeltaMinutes = options.maxTimeDeltaMinutes ?? options.timeWindowMinutes ?? this.defaults.maxTimeDeltaMinutes;
    const minSemanticSimilarity = options.minSemanticSimilarity ?? this.defaults.minSemanticSimilarity;
    const minFusionConfidence = options.minConfidence ?? this.defaults.minFusionConfidence;

    // 1. Extract Categories & Hazard Compatibility
    const categoryA = this.extractCategory(reportA);
    const categoryB = this.extractCategory(reportB);
    const hazardCompatible = this.isHazardCompatible(categoryA, categoryB);

    // 2. Geographic Proximity Signal
    const coordsA = this.extractCoordinates(reportA);
    const coordsB = this.extractCoordinates(reportB);
    const distanceMeters = this.calculateDistanceMeters(coordsA.lat, coordsA.lng, coordsB.lat, coordsB.lng);
    const hasGps = distanceMeters !== null;
    const geographic = hasGps ? (distanceMeters <= maxDistanceMeters) : false;

    // 3. Temporal Proximity Signal
    const timeA = this.extractTimestamp(reportA);
    const timeB = this.extractTimestamp(reportB);
    const timeDeltaMs = Math.abs(timeA.getTime() - timeB.getTime());
    const timeDeltaMinutes = Math.round(timeDeltaMs / (60 * 1000));
    const temporal = timeDeltaMinutes <= maxTimeDeltaMinutes;

    // 4. Semantic Similarity Signal
    let similarityScore = 0.0;
    if (typeof options.semanticSimilarity === 'number') {
      similarityScore = options.semanticSimilarity;
    } else if (options.overrideSimilarity != null) {
      similarityScore = Number(options.overrideSimilarity);
    } else {
      const simResult = this.similarityService.calculateSimilarity(reportA, reportB, { threshold: minSemanticSimilarity });
      similarityScore = simResult.similarityScore || 0.0;
    }
    const semantic = similarityScore >= minSemanticSimilarity;

    // Assemble Signals
    const signals = {
      geographic,
      semantic,
      temporal,
      hazardCompatible,
    };

    // Calculate Multi-Signal Agreement Count
    const agreedCount = [geographic, semantic, temporal, hazardCompatible].filter(Boolean).length;

    // 5. Calibrated Confidence Score Computation (0.0 to 1.0)
    let geoWeightScore = 0;
    if (hasGps) {
      const distRatio = Math.min(1.0, distanceMeters / Math.max(1, maxDistanceMeters));
      geoWeightScore = (1.0 - distRatio) * 0.35;
    } else {
      geoWeightScore = 0.15;
    }

    const semanticWeightScore = similarityScore * 0.30;

    const timeRatio = Math.min(1.0, timeDeltaMinutes / Math.max(1, maxTimeDeltaMinutes));
    const temporalWeightScore = (1.0 - timeRatio) * 0.20;

    const hazardWeightScore = categoryA === categoryB
      ? 0.15
      : (hazardCompatible ? 0.08 : 0.0);

    let calculatedConfidence = geoWeightScore + semanticWeightScore + temporalWeightScore + hazardWeightScore;
    calculatedConfidence = Math.max(0.0, Math.min(0.99, Number(calculatedConfidence.toFixed(2))));

    // 6. Strict Multi-Signal Decision Rules:
    // A report is a fusion candidate ONLY when multiple signals agree:
    // - Geographic MUST be close (if GPS exists)
    // - Temporal MUST be in range
    // - Hazard MUST be compatible
    // - Semantic MUST be similar (or exact same category with high spatial/temporal overlap)
    let related = false;
    let reason = '';

    if (!hazardCompatible && !semantic) {
      related = false;
      calculatedConfidence = Math.min(calculatedConfidence, 0.40);
      reason = `Incompatible emergency categories (${categoryA} vs ${categoryB}) with low semantic similarity (${similarityScore.toFixed(2)}). Reports represent distinct events. Do not automatically merge.`;
    } else if (hasGps && !geographic) {
      related = false;
      calculatedConfidence = Math.min(calculatedConfidence, 0.50);
      reason = `Geographic distance (${distanceMeters}m > ${maxDistanceMeters}m limit) exceeds proximity boundary. Separate physical locations. Do not merge.`;
    } else if (!temporal) {
      related = false;
      calculatedConfidence = Math.min(calculatedConfidence, 0.45);
      reason = `Time delta (${timeDeltaMinutes} minutes > ${maxTimeDeltaMinutes}m limit) exceeds temporal window. Distinct operational timeframes. Do not merge.`;
    } else if (!semantic && !hazardCompatible) {
      related = false;
      calculatedConfidence = Math.min(calculatedConfidence, 0.40);
      reason = `Insufficient semantic similarity (${similarityScore.toFixed(2)} < ${minSemanticSimilarity}) and divergent hazard types. Do not merge.`;
    } else if (agreedCount >= 3 && geographic && temporal && (hazardCompatible || semantic)) {
      related = true;
      calculatedConfidence = Math.max(calculatedConfidence, 0.75);

      const distanceDesc = hasGps ? `${distanceMeters}m proximity` : 'GPS unavailable';
      const timeDesc = `${timeDeltaMinutes} minute(s) delta`;
      const catDesc = categoryA === categoryB ? `matching category (${categoryA})` : `compatible categories (${categoryA} & ${categoryB})`;

      reason = `Strong multi-signal correlation: ${catDesc}, ${distanceDesc}, ${timeDesc}, and semantic similarity of ${similarityScore.toFixed(2)}. Reports are likely describing the same incident.`;
    } else {
      related = false;
      const failingSignals = [];
      if (!geographic) failingSignals.push(hasGps ? `distance (${distanceMeters}m > ${maxDistanceMeters}m)` : 'missing GPS');
      if (!semantic) failingSignals.push(`low semantic similarity (${similarityScore.toFixed(2)} < ${minSemanticSimilarity})`);
      if (!temporal) failingSignals.push(`time delta (${timeDeltaMinutes}m > ${maxTimeDeltaMinutes}m)`);
      if (!hazardCompatible) failingSignals.push(`divergent categories (${categoryA} vs ${categoryB})`);

      reason = `Insufficient multi-signal agreement. Weak correlation in: ${failingSignals.join(', ')}. Do not merge.`;
    }

    logger.info(`[IncidentFusionDecision] Pair evaluated (Related: ${related}, Confidence: ${calculatedConfidence}, Agreed: ${agreedCount}/4)`);

    return {
      related,
      confidence: calculatedConfidence,
      reason,
      signals,
      metrics: {
        distanceMeters,
        hasGps,
        timeDeltaMinutes,
        similarityScore,
        categoryA,
        categoryB,
      },
    };
  }

  /**
   * Partitions an array of incident records into analytical cluster views (non-destructive)
   * @param {Array<Object>} incidentsList
   * @param {Object} [options]
   * @returns {Array<Object>} List of analytical cluster views
   */
  createAnalyticalClusterViews(incidentsList = [], options = {}) {
    if (!Array.isArray(incidentsList) || incidentsList.length === 0) {
      return [];
    }

    // Step 1: Strict Deduplication
    // Do not count the same incident multiple times using incidentId / clientRequestId
    const deduplicated = [];
    const seenKeys = new Set();

    for (const inc of incidentsList) {
      if (!inc) continue;
      const key = String(
        inc.clientRequestId ||
        inc.packetId ||
        inc._id ||
        inc.id ||
        inc.incident_id ||
        ''
      ).trim();

      if (key && seenKeys.has(key)) {
        logger.debug(`[IncidentFusionDecision] Deduplicated redundant SOS report: '${key}'`);
        continue;
      }
      if (key) seenKeys.add(key);
      deduplicated.push(inc);
    }

    if (deduplicated.length === 0) {
      return [];
    }

    // Step 2: Build Proximity Graph using Deterministic Haversine Distance & Multi-Signal Rules
    const n = deduplicated.length;
    const adj = Array.from({ length: n }, () => []);

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const evalResult = this.evaluatePair(deduplicated[i], deduplicated[j], options);
        if (evalResult.related) {
          adj[i].push(j);
          adj[j].push(i);
        }
      }
    }

    // Step 3: Extract Connected Components (Density-connected Spatial Clusters)
    const visited = new Set();
    const clusters = [];

    for (let i = 0; i < n; i++) {
      if (visited.has(i)) continue;

      const componentIndices = [];
      const queue = [i];
      visited.add(i);

      while (queue.length > 0) {
        const curr = queue.shift();
        componentIndices.push(curr);

        for (const neighbor of adj[curr]) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }

      const clusterMembers = componentIndices.map((idx) => deduplicated[idx]);

      // Determine dominant category across cluster members
      const categoryCounts = {};
      clusterMembers.forEach((m) => {
        const cat = this.extractCategory(m);
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      });
      let dominantCategory = this.extractCategory(clusterMembers[0]);
      let maxCount = 0;
      for (const [cat, cnt] of Object.entries(categoryCounts)) {
        if (cnt > maxCount) {
          maxCount = cnt;
          dominantCategory = cat;
        }
      }

      const memberIds = clusterMembers.map((m) => String(m._id || m.id || m.packetId || m.clientRequestId || m.incident_id));

      clusters.push({
        clusterId: `cluster_${dominantCategory.toLowerCase()}_${Date.now()}_${clusters.length + 1}`,
        dominantCategory,
        reportCount: clusterMembers.length,
        numberOfReports: clusterMembers.length,
        incidentIds: memberIds,
        incidents: clusterMembers, // View reference only
        reports: clusterMembers, // Pristine accessible original citizen reports
        isMultiCitizenCluster: clusterMembers.length > 1,
        createdAt: new Date().toISOString(),
      });
    }

    return clusters;
  }
}

const incidentFusionDecisionEngine = new IncidentFusionDecisionEngine();

module.exports = incidentFusionDecisionEngine;
module.exports.IncidentFusionDecisionEngine = IncidentFusionDecisionEngine;
