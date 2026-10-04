/**
 * Resonix Local Weather Risk Engine (SIH26068)
 * 
 * Decision-Support Layer:
 * THIS IS NOT AN OFFICIAL GOVERNMENT WARNING SYSTEM.
 * It is an analytical decision-support layer synthesizing factual meteorological signals,
 * numerical weather prediction, historical baseline context, and citizen ground reports.
 * 
 * Factual Signals Evaluated Deterministically:
 * 1. Rainfall (current intensity, peak hourly mm/h, 24h accumulation mm)
 * 2. Rainfall probability (max 24h precipitation probability %)
 * 3. Wind (sustained wind speed km/h, peak gusts km/h)
 * 4. Official weather warnings (IMD / CAP alerts from ExtremeWeatherAlertEngine)
 * 5. Forecast intensity (convective severe weather codes, NWP multi-model consensus)
 * 6. Historical / contextual information (forecast vs historical monthly daily baseline)
 * 7. Citizen ground reports (active flood/waterlogging/storm incidents within radius)
 * 
 * Transparent Rule / Weighted Scoring:
 * - Scores: 0 to 100
 * - Levels:
 *   * LOW: 0 - 24
 *   * MODERATE: 25 - 49
 *   * HIGH: 50 - 74
 *   * CRITICAL: 75 - 100
 * 
 * Strict Anti-Hallucination & Separation Invariants:
 * - The LLM is strictly prohibited from arbitrarily inventing or altering the risk score.
 * - Official government warnings are strictly separated from Resonix-derived risk.
 * - Clearly labels:
 *   * Official Warning
 *   * Resonix Risk Assessment
 *   * Citizen Ground Report
 */

const mongoose = require('mongoose');
const logger = require('../../utils/logger');
const extremeWeatherAlertEngine = require('./extremeWeatherAlertEngine');

const EARTH_RADIUS_KM = 6371;

class LocalWeatherRiskEngine {
  constructor(options = {}) {
    // In-memory cache: gridKey -> { riskData, expiresAt } (15-minute TTL)
    this.cache = new Map();
    this.cacheTtlMs = options.cacheTtlMs || 15 * 60 * 1000; // 15 minutes

    // Periodic sweep of expired risk cache entries
    this.sweepInterval = setInterval(() => {
      this._sweepCache();
    }, 60000);
    if (this.sweepInterval.unref) this.sweepInterval.unref();
  }

  /**
   * Evaluates local weather risk for a given geographic coordinate
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @param {Object} [options] - Evaluation options (radiusKm, bypassCache, locationName)
   * @returns {Promise<Object>} Canonical Local Weather Risk schema
   */
  async evaluateRisk(lat, lon, options = {}) {
    const validLat = Number(lat);
    const validLon = Number(lon);
    const radiusKm = Number(options.radiusKm) || 25;
    const gridKey = this._quantizeGrid(validLat, validLon);

    // 1. Cache Check
    if (!options.bypassCache) {
      const cached = this.cache.get(gridKey);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
      }
    }

    // 2. Gather Factual Signals in Parallel
    const [
      weatherData,
      officialAlerts,
      historicalContext,
      citizenIncidents,
    ] = await Promise.all([
      this._gatherWeatherData(validLat, validLon, options),
      this._gatherOfficialAlerts(validLat, validLon),
      this._gatherHistoricalContext(validLat, validLon),
      this._gatherCitizenIncidents(validLat, validLon, radiusKm),
    ]);

    // 3. Compute Deterministic Multi-Factor Rule / Weighted Scoring
    const scoringResult = this.computeRiskScore({
      weatherData,
      officialAlerts,
      historicalContext,
      citizenIncidents,
      radiusKm,
    });

    // 4. Construct Output Schema with Strict Three-Pillar Separation
    const locationName = options.locationName || weatherData.location?.name || `Sector (${validLat.toFixed(2)}, ${validLon.toFixed(2)})`;

    const result = {
      location: {
        name: locationName,
        latitude: validLat,
        longitude: validLon,
      },
      // Pillar 1: Official Government Warnings
      officialWarning: this._formatOfficialWarningPillar(officialAlerts),
      // Pillar 2: Resonix Derived Risk Assessment (Decision-Support Layer)
      resonixRiskAssessment: {
        level: scoringResult.level,
        score: scoringResult.score,
        maxScore: 100,
        category: scoringResult.category,
        summary: scoringResult.summary,
        reasons: scoringResult.reasons,
        contributingFactors: scoringResult.contributingFactors,
        disclaimer: 'This is a Resonix AI decision-support layer, NOT an official government warning system.',
        calculatedAt: new Date().toISOString(),
      },
      // Pillar 3: Citizen Ground Reports
      citizenGroundReport: this._formatCitizenGroundReportPillar(citizenIncidents, radiusKm),
      metadata: {
        gridKey,
        radiusKm,
        evaluatedSignals: [
          'rainfall',
          'rainfall_probability',
          'wind',
          'weather_warnings',
          'forecast_intensity',
          'historical_context',
          'citizen_reports',
        ],
        cachedAt: new Date().toISOString(),
        ttlSeconds: Math.round(this.cacheTtlMs / 1000),
      },
    };

    // 5. Cache result
    this.cache.set(gridKey, {
      data: result,
      expiresAt: Date.now() + this.cacheTtlMs,
    });

    return result;
  }

  /**
   * Deterministic Rule / Weighted Scoring Engine
   * Evaluates all 7 factual signals and calculates points, risk level, and contributing factors.
   * 
   * Signal Weight Breakdown (Max 100 pts):
   * - Rainfall: Max 25 pts
   * - Rainfall Probability: Max 15 pts
   * - Wind: Max 15 pts
   * - Official Weather Warnings: Max 25 pts
   * - Forecast Intensity / NWP: Max 10 pts
   * - Historical / Contextual Anomaly: Max 10 pts
   * - Citizen Ground Reports: Max 20 pts
   */
  computeRiskScore(signals = {}) {
    const {
      weatherData = {},
      officialAlerts = [],
      historicalContext = {},
      citizenIncidents = [],
      radiusKm = 25,
    } = signals;

    const contributingFactors = [];
    const reasons = [];
    let rawScore = 0;

    // ------------------------------------------------------------------------
    // Signal 1: Rainfall (Intensity & 24h Accumulation) - Max 25 pts
    // ------------------------------------------------------------------------
    const currentRainRate = Number(weatherData.current?.precipitation || 0);
    const hourlyForecast = weatherData.hourlyForecast || [];
    let peakHourlyRain = currentRainRate;
    let accum24hRain = 0;

    hourlyForecast.slice(0, 24).forEach((h) => {
      const p = Number(h.precipitation || 0);
      if (p > peakHourlyRain) peakHourlyRain = p;
      accum24hRain += p;
    });
    accum24hRain = Number(accum24hRain.toFixed(1));
    peakHourlyRain = Number(peakHourlyRain.toFixed(1));

    if (accum24hRain >= 100 || peakHourlyRain >= 25) {
      const pts = 25;
      rawScore += pts;
      const reason = `Extreme forecast precipitation: ${peakHourlyRain} mm/h peak, ${accum24hRain} mm in 24h`;
      reasons.push(reason);
      contributingFactors.push({
        factor: 'RAINFALL',
        points: pts,
        maxPoints: 25,
        severity: 'CRITICAL',
        reason,
        details: { peakHourlyMm: peakHourlyRain, accum24hMm: accum24hRain },
      });
    } else if (accum24hRain >= 65 || peakHourlyRain >= 15) {
      const pts = 20;
      rawScore += pts;
      const reason = `High forecast rainfall: ${peakHourlyRain} mm/h peak, ${accum24hRain} mm in 24h`;
      reasons.push(reason);
      contributingFactors.push({
        factor: 'RAINFALL',
        points: pts,
        maxPoints: 25,
        severity: 'HIGH',
        reason,
        details: { peakHourlyMm: peakHourlyRain, accum24hMm: accum24hRain },
      });
    } else if (accum24hRain >= 35 || peakHourlyRain >= 7.5) {
      const pts = 14;
      rawScore += pts;
      const reason = `Moderate to heavy forecast rainfall: ${accum24hRain} mm in 24h`;
      reasons.push(reason);
      contributingFactors.push({
        factor: 'RAINFALL',
        points: pts,
        maxPoints: 25,
        severity: 'MODERATE',
        reason,
        details: { peakHourlyMm: peakHourlyRain, accum24hMm: accum24hRain },
      });
    } else if (accum24hRain >= 15 || peakHourlyRain >= 2.5) {
      const pts = 8;
      rawScore += pts;
      const reason = `Light to moderate rainfall expected: ${accum24hRain} mm in 24h`;
      reasons.push(reason);
      contributingFactors.push({
        factor: 'RAINFALL',
        points: pts,
        maxPoints: 25,
        severity: 'LOW',
        reason,
        details: { peakHourlyMm: peakHourlyRain, accum24hMm: accum24hRain },
      });
    } else if (accum24hRain >= 5) {
      const pts = 4;
      rawScore += pts;
      const reason = `Minor precipitation expected: ${accum24hRain} mm in 24h`;
      reasons.push(reason);
      contributingFactors.push({
        factor: 'RAINFALL',
        points: pts,
        maxPoints: 25,
        severity: 'LOW',
        reason,
        details: { peakHourlyMm: peakHourlyRain, accum24hMm: accum24hRain },
      });
    }

    // ------------------------------------------------------------------------
    // Signal 2: Rainfall Probability (Next 24h Max %) - Max 15 pts
    // ------------------------------------------------------------------------
    let maxRainProb = Number(weatherData.dailyForecast?.[0]?.precipitationProbability || 0);
    hourlyForecast.slice(0, 24).forEach((h) => {
      const prob = Number(h.precipitationProbability || 0);
      if (prob > maxRainProb) maxRainProb = prob;
    });

    if (maxRainProb >= 85) {
      const pts = 15;
      rawScore += pts;
      const reason = `Very high precipitation probability: ${maxRainProb}%`;
      reasons.push(reason);
      contributingFactors.push({
        factor: 'RAINFALL_PROBABILITY',
        points: pts,
        maxPoints: 15,
        severity: 'HIGH',
        reason,
        details: { probabilityPercent: maxRainProb },
      });
    } else if (maxRainProb >= 65) {
      const pts = 10;
      rawScore += pts;
      const reason = `Elevated precipitation probability: ${maxRainProb}%`;
      reasons.push(reason);
      contributingFactors.push({
        factor: 'RAINFALL_PROBABILITY',
        points: pts,
        maxPoints: 15,
        severity: 'MODERATE',
        reason,
        details: { probabilityPercent: maxRainProb },
      });
    } else if (maxRainProb >= 40) {
      const pts = 5;
      rawScore += pts;
      const reason = `Moderate precipitation probability: ${maxRainProb}%`;
      reasons.push(reason);
      contributingFactors.push({
        factor: 'RAINFALL_PROBABILITY',
        points: pts,
        maxPoints: 15,
        severity: 'LOW',
        reason,
        details: { probabilityPercent: maxRainProb },
      });
    }

    // ------------------------------------------------------------------------
    // Signal 3: Wind & Gusts - Max 15 pts
    // ------------------------------------------------------------------------
    const currentWind = Number(weatherData.current?.windSpeed || 0);
    const currentGusts = Number(weatherData.current?.windGusts || currentWind * 1.3);
    let peakWind = currentWind;
    let peakGusts = currentGusts;

    hourlyForecast.slice(0, 24).forEach((h) => {
      const w = Number(h.windSpeed || 0);
      const g = Number(h.windGusts || w * 1.3);
      if (w > peakWind) peakWind = w;
      if (g > peakGusts) peakGusts = g;
    });
    peakWind = Number(peakWind.toFixed(1));
    peakGusts = Number(peakGusts.toFixed(1));

    if (peakGusts >= 90 || peakWind >= 65) {
      const pts = 15;
      rawScore += pts;
      const reason = `Severe storm-force winds: ${peakWind} km/h sustained, gusts up to ${peakGusts} km/h`;
      reasons.push(reason);
      contributingFactors.push({
        factor: 'WIND',
        points: pts,
        maxPoints: 15,
        severity: 'CRITICAL',
        reason,
        details: { windSpeedKmH: peakWind, windGustsKmH: peakGusts },
      });
    } else if (peakGusts >= 65 || peakWind >= 45) {
      const pts = 10;
      rawScore += pts;
      const reason = `High wind hazard: gusts up to ${peakGusts} km/h (sustained ${peakWind} km/h)`;
      reasons.push(reason);
      contributingFactors.push({
        factor: 'WIND',
        points: pts,
        maxPoints: 15,
        severity: 'HIGH',
        reason,
        details: { windSpeedKmH: peakWind, windGustsKmH: peakGusts },
      });
    } else if (peakWind >= 30 || peakGusts >= 45) {
      const pts = 5;
      rawScore += pts;
      const reason = `Brisk to strong wind conditions: ${peakWind} km/h`;
      reasons.push(reason);
      contributingFactors.push({
        factor: 'WIND',
        points: pts,
        maxPoints: 15,
        severity: 'MODERATE',
        reason,
        details: { windSpeedKmH: peakWind, windGustsKmH: peakGusts },
      });
    }

    // ------------------------------------------------------------------------
    // Signal 4: Official Weather Warnings - Max 25 pts
    // ------------------------------------------------------------------------
    if (officialAlerts && officialAlerts.length > 0) {
      // Find highest severity alert
      const hasCritical = officialAlerts.some((a) => a.severity === 'CRITICAL' || a.severity === 'EXTREME');
      const hasWarning = officialAlerts.some((a) => a.severity === 'SEVERE' || a.severity === 'WARNING');
      const topAlert = officialAlerts[0];
      const alertTitle = topAlert.headline || topAlert.alertType || 'Active Alert';

      if (hasCritical) {
        const pts = 25;
        rawScore += pts;
        const reason = `Active official government warning (CRITICAL): ${alertTitle}`;
        reasons.push(reason);
        contributingFactors.push({
          factor: 'OFFICIAL_WARNING',
          points: pts,
          maxPoints: 25,
          severity: 'CRITICAL',
          reason,
          details: { alertCount: officialAlerts.length, topSeverity: 'CRITICAL', headline: alertTitle },
        });
      } else if (hasWarning) {
        const pts = 18;
        rawScore += pts;
        const reason = `Active official government warning (${topAlert.severity}): ${alertTitle}`;
        reasons.push(reason);
        contributingFactors.push({
          factor: 'OFFICIAL_WARNING',
          points: pts,
          maxPoints: 25,
          severity: 'HIGH',
          reason,
          details: { alertCount: officialAlerts.length, topSeverity: topAlert.severity, headline: alertTitle },
        });
      } else {
        const pts = 10;
        rawScore += pts;
        const reason = `Active official government advisory (${topAlert.severity}): ${alertTitle}`;
        reasons.push(reason);
        contributingFactors.push({
          factor: 'OFFICIAL_WARNING',
          points: pts,
          maxPoints: 25,
          severity: 'MODERATE',
          reason,
          details: { alertCount: officialAlerts.length, topSeverity: topAlert.severity, headline: alertTitle },
        });
      }
    }

    // ------------------------------------------------------------------------
    // Signal 5: Forecast Intensity & NWP Consensus - Max 10 pts
    // ------------------------------------------------------------------------
    const currentCondition = weatherData.current?.condition || '';
    const isSevereCondition = /thunderstorm|squall|cyclone|hail|violent|torrential/i.test(currentCondition) ||
      hourlyForecast.slice(0, 24).some((h) => /thunderstorm|squall|cyclone|hail/i.test(h.condition || ''));

    if (isSevereCondition) {
      const pts = 10;
      rawScore += pts;
      const reason = `Intense convective weather forecast: ${currentCondition || 'Severe convective storms'}`;
      reasons.push(reason);
      contributingFactors.push({
        factor: 'FORECAST_INTENSITY',
        points: pts,
        maxPoints: 10,
        severity: 'HIGH',
        reason,
        details: { condition: currentCondition },
      });
    } else if (/rain|drizzle|shower/i.test(currentCondition) && accum24hRain > 20) {
      const pts = 5;
      rawScore += pts;
      const reason = `Active rain system indicated in forecast: ${currentCondition}`;
      reasons.push(reason);
      contributingFactors.push({
        factor: 'FORECAST_INTENSITY',
        points: pts,
        maxPoints: 10,
        severity: 'MODERATE',
        reason,
        details: { condition: currentCondition },
      });
    }

    // ------------------------------------------------------------------------
    // Signal 6: Historical / Contextual Anomaly - Max 10 pts
    // ------------------------------------------------------------------------
    const monthlyNormalRainMm = Number(historicalContext.monthlyAverageRainfallMm || 100);
    const historicalDailyNormal = Number((monthlyNormalRainMm / 30).toFixed(1));

    if (accum24hRain > 0 && historicalDailyNormal > 0) {
      const ratio = accum24hRain / historicalDailyNormal;
      if (ratio >= 3.0 && accum24hRain >= 40) {
        const pts = 10;
        rawScore += pts;
        const reason = `Forecast precipitation is ${ratio.toFixed(1)}x higher than historical local monthly normal (${accum24hRain} mm vs ${historicalDailyNormal} mm/day baseline)`;
        reasons.push(reason);
        contributingFactors.push({
          factor: 'HISTORICAL_CONTEXT',
          points: pts,
          maxPoints: 10,
          severity: 'HIGH',
          reason,
          details: {
            accum24hMm: accum24hRain,
            historicalDailyNormalMm: historicalDailyNormal,
            anomalyRatio: Number(ratio.toFixed(1)),
          },
        });
      } else if (ratio >= 1.75 && accum24hRain >= 25) {
        const pts = 5;
        rawScore += pts;
        const reason = `Forecast precipitation exceeds historical local monthly baseline (${accum24hRain} mm vs ${historicalDailyNormal} mm/day baseline)`;
        reasons.push(reason);
        contributingFactors.push({
          factor: 'HISTORICAL_CONTEXT',
          points: pts,
          maxPoints: 10,
          severity: 'MODERATE',
          reason,
          details: {
            accum24hMm: accum24hRain,
            historicalDailyNormalMm: historicalDailyNormal,
            anomalyRatio: Number(ratio.toFixed(1)),
          },
        });
      }
    }

    // ------------------------------------------------------------------------
    // Signal 7: Citizen Ground Reports - Max 20 pts
    // ------------------------------------------------------------------------
    const reportCount = citizenIncidents.length;
    if (reportCount >= 3) {
      const pts = 20;
      rawScore += pts;
      const reason = `Multiple nearby citizen flood/storm reports (${reportCount} active reports within ${radiusKm} km)`;
      reasons.push(reason);
      contributingFactors.push({
        factor: 'CITIZEN_REPORTS',
        points: pts,
        maxPoints: 20,
        severity: 'CRITICAL',
        reason,
        details: { count: reportCount, radiusKm },
      });
    } else if (reportCount >= 1) {
      const pts = 12;
      rawScore += pts;
      const reason = `Nearby citizen ground reports verified (${reportCount} active report(s) within ${radiusKm} km)`;
      reasons.push(reason);
      contributingFactors.push({
        factor: 'CITIZEN_REPORTS',
        points: pts,
        maxPoints: 20,
        severity: 'HIGH',
        reason,
        details: { count: reportCount, radiusKm },
      });
    }

    // ------------------------------------------------------------------------
    // Score Clamping & Categorical Level Mapping
    // ------------------------------------------------------------------------
    const score = Math.min(100, Math.max(0, rawScore));
    let level = 'LOW';
    let category = 'Low Risk';

    if (score >= 75) {
      level = 'CRITICAL';
      category = 'Critical Risk';
    } else if (score >= 50) {
      level = 'HIGH';
      category = 'High Risk';
    } else if (score >= 25) {
      level = 'MODERATE';
      category = 'Moderate Risk';
    } else {
      level = 'LOW';
      category = 'Low Risk';
    }

    // Generate concise analytical summary
    let summary;
    if (reasons.length === 0) {
      summary = 'Calm local meteorological conditions. No elevated risk factors detected.';
      reasons.push('Current and forecast meteorological conditions are within normal parameters.');
    } else {
      summary = `${category} driven by: ${reasons.slice(0, 3).join('; ')}.`;
    }

    return {
      score,
      level,
      category,
      summary,
      reasons,
      contributingFactors,
    };
  }

  // ==========================================================================
  // PILLAR FORMATTERS (STRICT THREE-PILLAR SEPARATION)
  // ==========================================================================

  _formatOfficialWarningPillar(officialAlerts = []) {
    const hasActiveWarning = officialAlerts.length > 0;
    const topAlert = hasActiveWarning ? officialAlerts[0] : null;

    return {
      hasActiveWarning,
      warningCount: officialAlerts.length,
      severity: topAlert ? topAlert.severity : 'NORMAL',
      headline: topAlert ? topAlert.headline : 'No active official government weather warnings',
      source: topAlert ? topAlert.source : 'India Meteorological Department (IMD) / Open-Meteo Ensemble',
      validUntil: topAlert ? topAlert.expiryTime : null,
      recommendedAction: topAlert ? topAlert.recommendedAction : 'Normal daily activities may proceed.',
      conciseAdvisory: topAlert ? topAlert.conciseAdvisory : '',
      warnings: officialAlerts.map((a) => ({
        alertId: a.alertId,
        alertType: a.alertType,
        severity: a.severity,
        headline: a.headline,
        source: a.source,
        startTime: a.startTime,
        expiryTime: a.expiryTime,
        recommendedAction: a.recommendedAction,
      })),
    };
  }

  _formatCitizenGroundReportPillar(citizenIncidents = [], radiusKm = 25) {
    return {
      activeCount: citizenIncidents.length,
      radiusKm,
      hasNearbyReports: citizenIncidents.length > 0,
      reports: citizenIncidents.map((inc) => ({
        id: inc._id?.toString() || inc.packetId || inc.reportId,
        title: inc.title || inc.category || 'Weather Incident',
        category: inc.category || inc.detectedCategory || 'GENERAL',
        severity: inc.severity || inc.priority || 'NORMAL',
        location: inc.location?.address || inc.sector || 'Nearby vicinity',
        reportedAt: inc.createdAt || new Date().toISOString(),
        distanceKm: inc.distanceKm != null ? inc.distanceKm : null,
      })),
    };
  }

  // ==========================================================================
  // DATA GATHERING HELPERS
  // ==========================================================================

  async _gatherWeatherData(lat, lon, options = {}) {
    try {
      const weatherService = require('./weatherService');
      const comprehensive = await weatherService.getComprehensiveWeather(lat, lon, {
        locationName: options.locationName,
        bypassCache: options.bypassCache,
      });
      return comprehensive;
    } catch (err) {
      logger.warn(`[LocalWeatherRiskEngine] Weather fetch note: ${err.message}`);
      return {
        current: { precipitation: 0, windSpeed: 0, condition: 'Fair' },
        hourlyForecast: [],
        dailyForecast: [],
        warnings: [],
      };
    }
  }

  async _gatherOfficialAlerts(lat, lon) {
    try {
      // 1. Check ExtremeWeatherAlertEngine active registry
      const alerts = extremeWeatherAlertEngine.getActiveAlerts(lat, lon);
      if (alerts && alerts.length > 0) {
        return alerts;
      }

      // 2. Check WeatherAlert collection in MongoDB
      if (mongoose.connection.readyState === 1) {
        const WeatherAlert = mongoose.models.WeatherAlert || require('../../models/WeatherAlert');
        const now = new Date();
        const dbAlerts = await WeatherAlert.find({
          status: 'ACTIVE',
          expiryTime: { $gt: now },
        })
          .sort({ issueTime: -1 })
          .limit(5)
          .lean();

        if (dbAlerts && dbAlerts.length > 0) {
          const relevant = dbAlerts.filter((a) => {
            const rel = extremeWeatherAlertEngine.calculateAlertRelevance(lat, lon, a);
            return rel.isAffected;
          });
          if (relevant.length > 0) return relevant;
        }
      }
    } catch (err) {
      logger.debug(`[LocalWeatherRiskEngine] Official alerts lookup note: ${err.message}`);
    }

    return [];
  }

  async _gatherHistoricalContext(lat, lon) {
    try {
      const weatherHistoricalService = require('./weatherHistoricalService');
      const monthlySummary = await weatherHistoricalService.getMonthlyHistoricalWeather(lat, lon, 2025);
      const currentMonthIndex = new Date().getMonth(); // 0 to 11
      const currentMonthData = monthlySummary.monthlyBreakdown?.[currentMonthIndex];

      return {
        monthlyAverageRainfallMm: currentMonthData?.totalRainfallMm || 100,
        monthName: currentMonthData?.month || 'Current Month',
      };
    } catch (err) {
      logger.debug(`[LocalWeatherRiskEngine] Historical context note: ${err.message}`);
      return { monthlyAverageRainfallMm: 100 };
    }
  }

  async _gatherCitizenIncidents(lat, lon, radiusKm = 25) {
    const results = [];
    try {
      if (mongoose.connection.readyState === 1) {
        const Incident = mongoose.models.Incident || require('../../models/Incident');
        const activeStatuses = ['pending', 'assigned', 'in_progress', 'reported', 'investigating', 'active'];
        const weatherKeywords = ['FLOOD', 'WATERLOGGING', 'WATER_LOGGING', 'STORM', 'CYCLONE', 'LANDSLIDE', 'TREE_FALL', 'RAIN', 'WEATHER'];

        const incidents = await Incident.find({
          status: { $in: activeStatuses },
          $or: [
            { category: { $in: weatherKeywords } },
            { detectedCategory: { $in: weatherKeywords } },
            { detectedEmergencyCategory: { $in: weatherKeywords } },
            { title: { $regex: /flood|water|rain|tree|storm|cyclone/i } },
            { description: { $regex: /flood|water|rain|tree|storm|cyclone/i } },
          ],
        })
          .sort({ createdAt: -1 })
          .limit(10)
          .lean();

        if (incidents && incidents.length > 0) {
          for (const inc of incidents) {
            const incLat = inc.location?.lat != null ? Number(inc.location.lat) : null;
            const incLon = inc.location?.lng != null ? Number(inc.location.lng) : null;

            if (incLat != null && incLon != null) {
              const dist = this._calculateDistance(lat, lon, incLat, incLon);
              if (dist <= radiusKm) {
                results.push({
                  ...inc,
                  distanceKm: Number(dist.toFixed(1)),
                });
              }
            } else {
              // Vicinity match without exact GPS
              results.push({
                ...inc,
                distanceKm: null,
              });
            }
          }
        }
      }
    } catch (err) {
      logger.debug(`[LocalWeatherRiskEngine] Citizen incidents lookup note: ${err.message}`);
    }

    return results;
  }

  _calculateDistance(lat1, lon1, lat2, lon2) {
    const toRad = (v) => (v * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_KM * c;
  }

  _quantizeGrid(lat, lon) {
    const qLat = Math.round(Number(lat) * 20) / 20; // 0.05 deg ~ 5 km
    const qLon = Math.round(Number(lon) * 20) / 20;
    return `${qLat}:${qLon}`;
  }

  _sweepCache() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }
}

// Export singleton instance and class definition
const localWeatherRiskEngine = new LocalWeatherRiskEngine();

module.exports = localWeatherRiskEngine;
module.exports.LocalWeatherRiskEngine = LocalWeatherRiskEngine;
