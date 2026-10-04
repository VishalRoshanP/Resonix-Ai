/**
 * Resonix Extreme Weather Alert Engine (SIH26068)
 * 
 * Ingestion & Real-Time Notification Pipeline:
 * Warning Feed
 *  -> Validate Alert Structure & Chronology
 *  -> Determine Affected Area
 *  -> Compare with Citizen Location (Geospatial Relevance)
 *  -> Determine Relevance (Distance / Radius / Bounding Box)
 *  -> Duplicate Alert Prevention (Fingerprint Hashing)
 *  -> Expiry Handling (Eviction from active & archive to history)
 *  -> Generate Concise Advisory
 *  -> Gemini Explanation (Explains retrieved alert; NEVER creates warnings independently)
 *  -> Notify Citizen (Socket.IO + In-App Banner + Browser Push Notification)
 * 
 * Strict Anti-Hallucination Invariant:
 * Gemini is strictly prohibited from creating official warnings independently.
 * Gemini may only explain a verified, retrieved warning.
 */

const crypto = require('crypto');
const mongoose = require('mongoose');
const logger = require('../../utils/logger');
const socketService = require('../socketService');
const gemmaClient = require('../gemma/gemmaClient');
const aiModelConfig = require('../../config/aiModels');

const EARTH_RADIUS_KM = 6371;

class ExtremeWeatherAlertEngine {
  constructor() {
    // In-Memory Fast Caches for O(1) Lookups & Standalone/Offline Reliability
    this.activeAlerts = new Map(); // alertId -> Alert Object
    this.alertFingerprints = new Map(); // fingerprint -> alertId
    this.alertHistory = []; // Array of all alerts (active, updated, expired)
    this.latestWarningByGrid = new Map(); // gridKey -> Alert Object
    this.maxHistorySize = 1000;

    this.primaryModel = aiModelConfig.models?.GEMINI_REASONING_MODEL || 'gemini-3.6-flash';

    // Start periodic auto-sweep for expired warnings every 60 seconds
    this.sweepInterval = setInterval(() => {
      this.handleExpiry();
    }, 60000);
    if (this.sweepInterval.unref) this.sweepInterval.unref();
  }

  // ==========================================================================
  // 1. WARNING FEED INGESTION & PIPELINE ENTRY
  // ==========================================================================

  /**
   * Processes an incoming warning feed item or array of warnings
   * @param {Object|Array} warningFeedData - Warning or array of warnings
   * @param {Object} [feedContext] - Optional context (e.g. source, location)
   * @returns {Promise<Object>} Ingestion outcome summary
   */
  async processWarningFeed(warningFeedData, feedContext = {}) {
    const rawWarnings = Array.isArray(warningFeedData) ? warningFeedData : [warningFeedData];
    const results = [];

    for (const raw of rawWarnings) {
      if (!raw) continue;

      try {
        // Step 1: Normalize & Validate Alert
        const normalized = this.normalizeAlert(raw, feedContext);
        const validation = this.validateAlert(normalized);

        if (!validation.isValid) {
          logger.warn(`[WeatherAlertEngine] Alert validation failed: ${validation.error}`);
          results.push({
            status: 'REJECTED_INVALID',
            error: validation.error,
            raw,
          });
          continue;
        }

        // Step 2: Expiry Check (Reject already-expired alerts from active feed)
        const isExpired = new Date(normalized.expiryTime).getTime() <= Date.now();
        if (isExpired) {
          normalized.status = 'EXPIRED';
          this._archiveToHistory(normalized);
          logger.info(`[WeatherAlertEngine] Ingested alert '${normalized.alertId}' is already expired. Archived directly to history.`);
          results.push({
            status: 'ARCHIVED_EXPIRED',
            alertId: normalized.alertId,
            alert: normalized,
          });
          continue;
        }

        // Step 3: Duplicate Alert Prevention
        const duplicateCheck = this.checkDuplicate(normalized);
        if (duplicateCheck.isDuplicate) {
          logger.info(`[WeatherAlertEngine] Duplicate alert suppressed: '${normalized.alertId}' (Fingerprint: ${normalized.fingerprint})`);
          results.push({
            status: 'SUPPRESSED_DUPLICATE',
            alertId: normalized.alertId,
            isNew: false,
            alert: this.activeAlerts.get(duplicateCheck.existingAlertId) || normalized,
          });
          continue;
        }

        // Step 4: Generate Concise Advisory
        normalized.conciseAdvisory = this.generateConciseAdvisory(normalized);

        // Step 5: Store in Active Registry & Persistent Storage
        const isUpdate = duplicateCheck.isUpdate;
        normalized.status = isUpdate ? 'UPDATED' : 'ACTIVE';

        this.activeAlerts.set(normalized.alertId, normalized);
        this.alertFingerprints.set(normalized.fingerprint, normalized.alertId);
        this._updateGridCache(normalized);
        this._archiveToHistory(normalized);

        await this._persistAlertToDb(normalized);

        // Step 6: Dispatch Notifications (Socket.IO + In-App / Push triggers)
        this.dispatchAlertNotifications(normalized, { isUpdate });

        logger.info(`[WeatherAlertEngine] ⚠️ Successfully processed ${normalized.status} weather alert: ${normalized.headline} (Severity: ${normalized.severity})`);

        results.push({
          status: normalized.status,
          isNew: true,
          alertId: normalized.alertId,
          alert: normalized,
        });
      } catch (err) {
        logger.error(`[WeatherAlertEngine] Processing error for alert: ${err.message}`);
        results.push({
          status: 'ERROR',
          error: err.message,
        });
      }
    }

    const newCount = results.filter((r) => r.status === 'ACTIVE').length;
    const updatedCount = results.filter((r) => r.status === 'UPDATED').length;
    const duplicateCount = results.filter((r) => r.status === 'SUPPRESSED_DUPLICATE').length;
    const expiredCount = results.filter((r) => r.status === 'ARCHIVED_EXPIRED').length;

    return {
      processedCount: results.length,
      newCount,
      updatedCount,
      duplicateCount,
      expiredCount,
      ingested: newCount + updatedCount,
      duplicates: duplicateCount,
      alerts: results.filter((r) => r.alert).map((r) => r.alert),
      results,
    };
  }

  // ==========================================================================
  // 2. NORMALIZATION & VALIDATION
  // ==========================================================================

  /**
   * Normalizes warning payload into authoritative schema
   */
  normalizeAlert(raw = {}, context = {}) {
    const headline = raw.headline || raw.event || raw.title || raw.hazard || 'Extreme Weather Warning';
    const alertType = this._resolveAlertType(raw.alertType || raw.type || headline);
    const severity = this._resolveSeverity(raw.severity || raw.level || raw.urgency);

    const now = new Date();
    const issueTime = raw.issueTime ? new Date(raw.issueTime).toISOString() : (raw.sent ? new Date(raw.sent).toISOString() : now.toISOString());
    const startTime = raw.startTime ? new Date(raw.startTime).toISOString() : (raw.onset ? new Date(raw.onset).toISOString() : issueTime);

    // Default expiry: 6 hours from start if not provided
    const defaultExpiry = new Date(new Date(startTime).getTime() + 6 * 60 * 60 * 1000).toISOString();
    const expiryTime = raw.expiryTime ? new Date(raw.expiryTime).toISOString() : (raw.expires ? new Date(raw.expires).toISOString() : defaultExpiry);

    // Affected Area Resolution (Supports CAP, IMD, GeoJSON, and Open-Meteo formats)
    const centerLat = Number(raw.affectedArea?.center?.latitude ?? raw.affectedArea?.center?.lat ?? raw.geometry?.center?.latitude ?? raw.geometry?.center?.lat ?? raw.latitude ?? raw.lat ?? context.latitude ?? 12.9716);
    const centerLon = Number(raw.affectedArea?.center?.longitude ?? raw.affectedArea?.center?.lon ?? raw.geometry?.center?.longitude ?? raw.geometry?.center?.lon ?? raw.longitude ?? raw.lon ?? context.longitude ?? 77.5946);
    const radiusKm = Number(raw.affectedArea?.radiusKm ?? raw.geometry?.radiusKm ?? raw.radiusKm ?? 25);
    const areaName = raw.affectedArea?.name || raw.areaDesc || raw.areaName || raw.location || context.locationName || 'Monitored Region';

    // Generate stable deterministic fingerprint
    const fingerprint = this._computeFingerprint({
      alertType,
      severity,
      areaName,
      centerLat: Math.round(centerLat * 100) / 100,
      centerLon: Math.round(centerLon * 100) / 100,
      startTime,
      expiryTime,
    });

    const alertId = raw.alertId || raw.id || `alert_${fingerprint.slice(0, 12)}`;

    return {
      alertId,
      fingerprint,
      alertType,
      severity,
      headline,
      description: raw.description || raw.details || headline,
      affectedArea: {
        name: areaName,
        center: {
          latitude: centerLat,
          longitude: centerLon,
        },
        radiusKm,
        boundingBox: raw.affectedArea?.boundingBox || this._computeBoundingBox(centerLat, centerLon, radiusKm),
      },
      issueTime,
      startTime,
      expiryTime,
      source: raw.source || raw.senderName || context.source || 'India Meteorological Department (IMD) / Open-Meteo Ensemble',
      recommendedAction: raw.recommendedAction || raw.instruction || raw.safetyRecommendation || 'Follow civil defense and meteorological guidance.',
      conciseAdvisory: raw.conciseAdvisory || '',
      aiExplanation: raw.aiExplanation || null,
      status: 'ACTIVE',
      metadata: raw.metadata || {},
    };
  }

  /**
   * Validates mandatory alert attributes and temporal chronology
   */
  validateAlert(alert) {
    if (!alert || typeof alert !== 'object') {
      return { isValid: false, error: 'Alert payload must be a non-null object' };
    }

    if (!alert.alertType || typeof alert.alertType !== 'string') {
      return { isValid: false, error: 'alertType is required' };
    }

    if (!['CRITICAL', 'EXTREME', 'SEVERE', 'WARNING', 'ADVISORY', 'WATCH', 'NORMAL'].includes(alert.severity)) {
      return { isValid: false, error: `Invalid severity level: ${alert.severity}` };
    }

    if (!alert.affectedArea || !alert.affectedArea.center) {
      return { isValid: false, error: 'affectedArea.center coordinates are required' };
    }

    const { latitude, longitude } = alert.affectedArea.center;
    if (isNaN(latitude) || Math.abs(latitude) > 90 || isNaN(longitude) || Math.abs(longitude) > 180) {
      return { isValid: false, error: 'Valid affectedArea center latitude [-90, 90] and longitude [-180, 180] required' };
    }

    // Chronology check
    const startMs = new Date(alert.startTime).getTime();
    const expiryMs = new Date(alert.expiryTime).getTime();

    if (isNaN(startMs) || isNaN(expiryMs)) {
      return { isValid: false, error: 'startTime and expiryTime must be valid ISO date strings' };
    }

    if (expiryMs <= startMs) {
      return { isValid: false, error: 'expiryTime must be strictly after startTime' };
    }

    return { isValid: true };
  }

  // ==========================================================================
  // 3. GEOSPATIAL RELEVANCE ENGINE (COMPARE WITH CITIZEN LOCATION)
  // ==========================================================================

  /**
   * Evaluates if a given citizen location is affected by an alert
   * Returns boolean (true/false)
   */
  isCitizenAffected(arg1, arg2, arg3) {
    const rel = this.calculateAlertRelevance(arg1, arg2, arg3);
    return rel.isAffected;
  }

  /**
   * Calculates comprehensive geospatial relevance details
   * @returns {Object} { isAffected, distanceKm, relevanceScore }
   */
  calculateAlertRelevance(arg1, arg2, arg3) {
    let citizenLat, citizenLon, alert;
    if (typeof arg1 === 'object' && arg1 !== null && arg1.affectedArea) {
      alert = arg1;
      citizenLat = arg2;
      citizenLon = arg3;
    } else {
      citizenLat = arg1;
      citizenLon = arg2;
      alert = arg3;
    }

    if (citizenLat == null || citizenLon == null || !alert?.affectedArea?.center) {
      return { isAffected: false, distanceKm: Infinity, relevanceScore: 0 };
    }

    const cLat = Number(citizenLat);
    const cLon = Number(citizenLon);
    const center = alert.affectedArea.center;
    const radiusKm = alert.affectedArea.radiusKm || 25;

    // 1. Distance check via Haversine formula
    const distanceKm = this.calculateHaversineDistance(cLat, cLon, center.latitude, center.longitude);
    const isWithinRadius = distanceKm <= radiusKm;

    // 2. Bounding Box check (if defined)
    const bbox = alert.affectedArea.boundingBox;
    let isWithinBbox = false;
    if (bbox && bbox.minLat != null && bbox.maxLat != null && bbox.minLon != null && bbox.maxLon != null) {
      isWithinBbox = cLat >= bbox.minLat && cLat <= bbox.maxLat && cLon >= bbox.minLon && cLon <= bbox.maxLon;
    }

    const isAffected = isWithinRadius || isWithinBbox;

    // Relevance score [0.0 - 1.0] (1.0 = at epicenter; 0.0 = at radius boundary or outside)
    const relevanceScore = isAffected
      ? Math.max(0.1, Number((1 - distanceKm / (radiusKm * 1.2)).toFixed(2)))
      : 0;

    return {
      isAffected,
      distanceKm: Number(distanceKm.toFixed(1)),
      relevanceScore,
    };
  }

  /**
   * Standard Haversine distance computation between two geographic points
   */
  calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const toRad = (v) => (v * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_KM * c;
  }

  // ==========================================================================
  // 4. DUPLICATE ALERT PREVENTION
  // ==========================================================================

  /**
   * Checks whether incoming alert is an exact duplicate or an update
   */
  checkDuplicate(alert) {
    const existingAlertId = this.alertFingerprints.get(alert.fingerprint);

    if (existingAlertId) {
      const existing = this.activeAlerts.get(existingAlertId);
      if (existing) {
        // If status changed or severity upgraded, treat as UPDATE rather than duplicate
        if (existing.severity !== alert.severity || existing.expiryTime !== alert.expiryTime) {
          return { isDuplicate: false, isUpdate: true, existingAlertId };
        }
        return { isDuplicate: true, isUpdate: false, existingAlertId };
      }
    }

    // Also check if exact alertId already exists with same content
    if (this.activeAlerts.has(alert.alertId)) {
      const existing = this.activeAlerts.get(alert.alertId);
      if (existing.fingerprint === alert.fingerprint) {
        return { isDuplicate: true, isUpdate: false, existingAlertId: alert.alertId };
      }
      return { isDuplicate: false, isUpdate: true, existingAlertId: alert.alertId };
    }

    return { isDuplicate: false, isUpdate: false };
  }

  // ==========================================================================
  // 5. EXPIRY HANDLING & CACHED LATEST WARNING
  // ==========================================================================

  /**
   * Sweeps expired alerts from active registry and tags them as EXPIRED in history
   */
  handleExpiry() {
    const nowMs = Date.now();
    let expiredCount = 0;

    for (const [alertId, alert] of this.activeAlerts.entries()) {
      if (new Date(alert.expiryTime).getTime() <= nowMs) {
        alert.status = 'EXPIRED';
        this.activeAlerts.delete(alertId);
        this.alertFingerprints.delete(alert.fingerprint);
        expiredCount++;
        logger.info(`[WeatherAlertEngine] ⏳ Alert '${alertId}' (${alert.headline}) has expired and was evicted from active cache.`);
      }
    }

    return { expiredCount, remainingActiveCount: this.activeAlerts.size };
  }

  /**
   * Returns active alerts relevant to a citizen's coordinates
   */
  getActiveAlerts(citizenLat, citizenLon) {
    this.handleExpiry(); // Auto-sweep on access

    const activeList = Array.from(this.activeAlerts.values());
    if (citizenLat == null || citizenLon == null) {
      return activeList;
    }

    return activeList
      .map((alert) => {
        const relevance = this.calculateAlertRelevance(citizenLat, citizenLon, alert);
        return {
          ...alert,
          relevance,
        };
      })
      .filter((a) => a.relevance.isAffected)
      .sort((a, b) => this._severityRank(b.severity) - this._severityRank(a.severity));
  }

  /**
   * O(1) quantized spatial cache lookup for latest warning
   */
  getLatestWarning(citizenLat, citizenLon) {
    this.handleExpiry();

    if (citizenLat == null || citizenLon == null) {
      const allActive = Array.from(this.activeAlerts.values());
      const top = allActive[0];
      return top ? { ...top, isCached: true, cachedAt: top.issueTime || new Date().toISOString() } : null;
    }

    const active = this.getActiveAlerts(citizenLat, citizenLon);
    if (active.length > 0) {
      return {
        ...active[0],
        isCached: true,
        cachedAt: active[0].issueTime || new Date().toISOString(),
      };
    }

    // Spatial grid fallback
    const gridKey = this._quantizeGrid(citizenLat, citizenLon);
    const cached = this.latestWarningByGrid.get(gridKey);
    if (cached && new Date(cached.expiryTime).getTime() > Date.now()) {
      return {
        ...cached,
        isCached: true,
        cachedAt: cached.issueTime || new Date().toISOString(),
      };
    }

    return null;
  }

  /**
   * Retrieves alert history with filtering
   */
  getAlertHistory(options = {}) {
    const { limit = 50, alertType, status } = options;
    let list = [...this.alertHistory];

    if (alertType) {
      list = list.filter((a) => a.alertType === alertType);
    }
    if (status) {
      list = list.filter((a) => a.status === status);
    }

    return list.slice(0, limit);
  }

  // ==========================================================================
  // 6. CONCISE ADVISORY & GEMINI EXPLANATION BOUNDARY
  // ==========================================================================

  /**
   * Deterministic operational advisory generated directly from verified alert fields
   */
  generateConciseAdvisory(alert) {
    const type = alert.alertType || 'WEATHER_HAZARD';
    const area = alert.affectedArea?.name || 'your area';
    const action = alert.recommendedAction || 'Exercise caution and monitor local updates.';
    const expiry = new Date(alert.expiryTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    return `⚠️ ${alert.severity} ADVISORY for ${area}: Active ${type.replace(/_/g, ' ').toLowerCase()}. ${action} Valid until ${expiry}. Source: ${alert.source}.`;
  }

  /**
   * Gemini / LLM Explanation Boundary
   * STRICT RULE: Never allow Gemini to create an official warning independently.
   * Gemini may ONLY explain an already retrieved and verified warning.
   */
  async explainWarningWithGemini(alert, userLanguage = 'en') {
    if (!alert || !alert.headline) {
      throw new Error('A valid, retrieved meteorological alert is required for explanation. Gemini cannot generate warnings independently.');
    }

    try {
      const prompt = `You are the Resonix Weather Intelligence explaining an OFFICIAL meteorological alert to a citizen.

AUTHORITATIVE ALERT DATA (DO NOT MODIFY OR INVENT FACTS):
- Alert Type: ${alert.alertType}
- Official Headline: ${alert.headline}
- Severity Level: ${alert.severity}
- Affected Area: ${alert.affectedArea?.name || 'Local region'}
- Valid Period: ${alert.startTime} to ${alert.expiryTime}
- Official Recommended Action: ${alert.recommendedAction}
- Issuing Authority: ${alert.source}

TASK:
Provide a clear, calming, and actionable 2-3 sentence explanation of this retrieved warning for a resident in this area.
Highlight what to do immediately, what hazards to avoid, and emergency readiness.
Do not invent any new severity levels or forecast metrics.`;

      const candidateModels = Array.from(new Set([
        'gemini-3.6-flash',
        this.primaryModel,
        'gemini-3.5-flash',
      ])).filter(Boolean);

      let explanationText = null;

      for (const targetModel of candidateModels) {
        try {
          const res = await gemmaClient.generateText(prompt, {
            model: targetModel,
            temperature: 0.2,
            maxTokens: 300,
            maxRetries: 1,
            timeoutMs: 6000,
          });

          if (res && res.text && res.text.trim()) {
            explanationText = res.text.trim();
            break;
          }
        } catch (_) {}
      }

      if (explanationText) {
        alert.aiExplanation = explanationText;
        return {
          alertId: alert.alertId,
          explanation: explanationText,
          authoritativeAlert: alert,
          actionChecklist: this._generateActionChecklist(alert),
          source: alert.source,
          explainedBy: 'Gemini Guided Explanation of Official Warning',
        };
      }
    } catch (err) {
      logger.warn(`[WeatherAlertEngine] Gemini explanation error: ${err.message}. Serving deterministic advisory.`);
    }

    // Deterministic fallback if Gemini is offline or rate-limited
    const fallbackExplanation = `${alert.headline}. Conditions in ${alert.affectedArea?.name || 'your area'} are currently classified as ${alert.severity}. Official recommendation: ${alert.recommendedAction}. Follow local civil defense guidance until alert expires.`;
    alert.aiExplanation = fallbackExplanation;

    return {
      alertId: alert.alertId,
      explanation: fallbackExplanation,
      authoritativeAlert: alert,
      actionChecklist: this._generateActionChecklist(alert),
      source: alert.source,
      explainedBy: 'Deterministic Meteorological Engine Fallback',
    };
  }

  _generateActionChecklist(alert) {
    const list = [];
    if (alert.recommendedAction) {
      list.push(alert.recommendedAction);
    }
    const type = alert.alertType || '';
    if (type === 'CYCLONE' || type === 'HIGH_WIND') {
      list.push('Secure loose exterior items and avoid maritime/coastal travel');
      list.push('Stay away from windows and identify a sturdy interior room');
    } else if (type === 'FLASH_FLOOD' || type === 'HEAVY_RAINFALL') {
      list.push('Move to higher ground immediately; do not drive through flooded roads');
      list.push('Unplug electrical appliances in ground-level or basement rooms');
    } else if (type === 'SEVERE_THUNDERSTORM' || type === 'HAILSTORM') {
      list.push('Seek immediate indoor shelter; avoid open fields and tall metal structures');
      list.push('Stay indoors until 30 minutes after the last thunderclap');
    } else if (type === 'EXTREME_HEAT') {
      list.push('Stay hydrated, avoid outdoor exertion during peak afternoon hours');
      list.push('Check on elderly neighbors and keep pets in shaded, cool areas');
    } else {
      list.push('Monitor official regional weather channels for urgent updates');
      list.push('Prepare an emergency battery-powered kit and charged mobile device');
    }
    return list;
  }

  // ==========================================================================
  // 7. NOTIFICATION DISPATCH (SOCKET.IO + IN-APP / PUSH)
  // ==========================================================================

  /**
   * Dispatches alert payload through Socket.IO real-time channels
   */
  dispatchAlertNotifications(alert, options = {}) {
    try {
      const payload = {
        type: 'WEATHER_ALERT',
        alertId: alert.alertId,
        alertType: alert.alertType,
        severity: alert.severity,
        headline: alert.headline,
        description: alert.description,
        affectedArea: alert.affectedArea,
        startTime: alert.startTime,
        expiryTime: alert.expiryTime,
        source: alert.source,
        recommendedAction: alert.recommendedAction,
        conciseAdvisory: alert.conciseAdvisory,
        isUpdate: Boolean(options.isUpdate),
        status: alert.status,
        timestamp: new Date().toISOString(),
      };

      // 1. Broadcast via SocketService
      if (socketService?.io) {
        // Send to responders room
        socketService.io.to('responders').emit('weather:alert', payload);
        // Send global broadcast to citizen web & mobile
        socketService.io.emit('weather:alert', payload);
      }
    } catch (err) {
      logger.warn(`[WeatherAlertEngine] Socket dispatch note: ${err.message}`);
    }
  }

  // ==========================================================================
  // PRIVATE UTILITIES
  // ==========================================================================

  _computeFingerprint(data) {
    const str = `${data.alertType}|${data.severity}|${data.areaName}|${data.centerLat}|${data.centerLon}|${data.startTime}|${data.expiryTime}`;
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  _computeBoundingBox(lat, lon, radiusKm) {
    const latDelta = radiusKm / 111;
    const lonDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
    return {
      minLat: Number((lat - latDelta).toFixed(4)),
      maxLat: Number((lat + latDelta).toFixed(4)),
      minLon: Number((lon - lonDelta).toFixed(4)),
      maxLon: Number((lon + lonDelta).toFixed(4)),
    };
  }

  _quantizeGrid(lat, lon) {
    const qLat = Math.round(Number(lat) * 20) / 20; // 0.05 deg ~ 5km
    const qLon = Math.round(Number(lon) * 20) / 20;
    return `${qLat}:${qLon}`;
  }

  _updateGridCache(alert) {
    const center = alert.affectedArea?.center;
    if (center?.latitude != null && center?.longitude != null) {
      const gridKey = this._quantizeGrid(center.latitude, center.longitude);
      this.latestWarningByGrid.set(gridKey, alert);
    }
  }

  _archiveToHistory(alert) {
    this.alertHistory.unshift({
      ...alert,
      archivedAt: new Date().toISOString(),
    });

    if (this.alertHistory.length > this.maxHistorySize) {
      this.alertHistory.pop();
    }
  }

  async _persistAlertToDb(alert) {
    try {
      if (mongoose.connection.readyState === 1) {
        const WeatherAlert = mongoose.models.WeatherAlert || require('../../models/WeatherAlert');
        await WeatherAlert.findOneAndUpdate(
          { alertId: alert.alertId },
          { $set: alert },
          { upsert: true, new: true }
        );
      }
    } catch (err) {
      logger.debug(`[WeatherAlertEngine] DB persistence note: ${err.message}`);
    }
  }

  _resolveAlertType(rawType = '') {
    const s = String(rawType).toUpperCase();
    if (s.includes('CYCLONE') || s.includes('HURRICANE') || s.includes('TYPHOON')) return 'CYCLONE';
    if (s.includes('THUNDER') || s.includes('LIGHTNING')) return 'SEVERE_THUNDERSTORM';
    if (s.includes('FLASH FLOOD') || s.includes('FLOOD')) return 'FLASH_FLOOD';
    if (s.includes('RAIN') || s.includes('PRECIPITATION') || s.includes('DOWNPOUR')) return 'HEAVY_RAINFALL';
    if (s.includes('HEAT') || s.includes('HEATWAVE')) return 'EXTREME_HEAT';
    if (s.includes('WIND') || s.includes('GALE') || s.includes('SQUALL')) return 'HIGH_WIND';
    if (s.includes('COLD') || s.includes('FREEZE') || s.includes('FROST')) return 'COLD_WAVE';
    if (s.includes('HAIL')) return 'HAILSTORM';
    return 'WEATHER_HAZARD';
  }

  _resolveSeverity(rawSev = '') {
    const s = String(rawSev).toUpperCase();
    if (s.includes('EMERGENCY') || s.includes('CRITICAL')) return 'CRITICAL';
    if (s.includes('EXTREME')) return 'EXTREME';
    if (s.includes('SEVERE')) return 'SEVERE';
    if (s.includes('WARN')) return 'WARNING';
    if (s.includes('ADVISORY')) return 'ADVISORY';
    if (s.includes('WATCH')) return 'WATCH';
    return 'WARNING';
  }

  _severityRank(sev) {
    switch (sev) {
      case 'CRITICAL': return 6;
      case 'EXTREME': return 5;
      case 'SEVERE': return 4;
      case 'WARNING': return 3;
      case 'ADVISORY': return 2;
      case 'WATCH': return 1;
      default: return 0;
    }
  }
}

// Export singleton instance and class definition
const extremeWeatherAlertEngine = new ExtremeWeatherAlertEngine();

module.exports = extremeWeatherAlertEngine;
module.exports.ExtremeWeatherAlertEngine = ExtremeWeatherAlertEngine;
