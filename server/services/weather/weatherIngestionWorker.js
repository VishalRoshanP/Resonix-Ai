/**
 * Weather Ingestion Worker
 * 
 * Autonomous background scheduled worker for periodic live meteorological data ingestion.
 * Flow:
 * Weather Provider -> Worker -> Validate -> Normalize -> Cache/MongoDB -> Socket.IO -> Clients
 */

const weatherService = require('./weatherService');
const weatherCache = require('./weatherCache');
const WeatherSnapshot = require('../../models/WeatherSnapshot');
const Incident = require('../../models/Incident');
const socketService = require('../socketService');
const extremeWeatherAlertEngine = require('./extremeWeatherAlertEngine');
const { enrichMetadataWithFreshness } = require('../../utils/weatherFreshness');
const logger = require('../../utils/logger');

const DEFAULT_INTERVAL_MS = parseInt(process.env.WEATHER_REFRESH_INTERVAL_MS, 10) || 10 * 60 * 1000; // 10 minutes

class WeatherIngestionWorker {
  constructor(options = {}) {
    this.intervalMs = options.intervalMs || DEFAULT_INTERVAL_MS;
    this.timer = null;
    this.isRunning = false;
    this.isCycleRunning = false;
    this.registeredLocations = new Map(); // key -> { lat, lon, name }
    this.providerStatus = 'HEALTHY';
    this.consecutiveFailures = 0;
    this.lastCycleTimestamp = null;
    this.lastSuccessfulCycle = null;

    // Default primary command hub
    const defaultLat = parseFloat(process.env.DEFAULT_LAT) || 12.9716;
    const defaultLon = parseFloat(process.env.DEFAULT_LON) || 77.5946;
    this.registerLocation(defaultLat, defaultLon, 'Command Operations Hub');
  }

  /**
   * Register a geographical point to be continuously ingested
   * @param {number} lat
   * @param {number} lon
   * @param {string} [name]
   */
  registerLocation(lat, lon, name = 'Target Location') {
    const qLat = weatherCache.quantize(lat);
    const qLon = weatherCache.quantize(lon);
    const key = `${qLat}:${qLon}`;
    this.registeredLocations.set(key, { lat: qLat, lon: qLon, name });
  }

  /**
   * Unregister a location
   * @param {number} lat
   * @param {number} lon
   */
  unregisterLocation(lat, lon) {
    const qLat = weatherCache.quantize(lat);
    const qLon = weatherCache.quantize(lon);
    this.registeredLocations.delete(`${qLat}:${qLon}`);
  }

  /**
   * Collect all target locations: registered hubs + active MongoDB disaster incidents
   * @returns {Promise<Array<{ lat: number, lon: number, name: string }>>}
   */
  async getTargetLocations() {
    const targets = new Map(this.registeredLocations);

    // Query active incidents from MongoDB if connected
    if (Incident?.db?.readyState === 1) {
      try {
        const activeIncidents = await Incident.find({
          status: { $in: ['ACTIVE', 'ASSIGNED', 'IN_PROGRESS', 'OPEN', 'PENDING'] },
          'location.lat': { $ne: null },
          'location.lng': { $ne: null },
        }).limit(25).select('location category title displayId');

        for (const inc of activeIncidents) {
          const lat = inc.location?.lat;
          const lon = inc.location?.lng;
          if (lat != null && lon != null && !isNaN(Number(lat)) && !isNaN(Number(lon))) {
            const qLat = weatherCache.quantize(lat);
            const qLon = weatherCache.quantize(lon);
            const key = `${qLat}:${qLon}`;
            if (!targets.has(key)) {
              targets.set(key, {
                lat: qLat,
                lon: qLon,
                name: `Active Incident Zone (${inc.displayId || inc.category})`,
              });
            }
          }
        }
      } catch (err) {
        logger.debug(`[WeatherWorker] Active incident lookup note: ${err.message}`);
      }
    }

    return Array.from(targets.values());
  }

  /**
   * Run a single ingestion cycle across all target locations
   * @returns {Promise<Object>} Cycle summary
   */
  async runIngestionCycle() {
    if (this.isCycleRunning) {
      logger.debug('[WeatherWorker] Ingestion cycle already in progress, skipping overlapping run.');
      return { skipped: true };
    }

    this.isCycleRunning = true;
    this.lastCycleTimestamp = new Date().toISOString();
    const targets = await this.getTargetLocations();
    logger.info(`[WeatherWorker] Starting weather ingestion cycle for ${targets.length} target location(s)...`);

    let successCount = 0;
    let failureCount = 0;

    for (const target of targets) {
      const gridKey = `${target.lat}:${target.lon}`;
      try {
        // 1. Fetch fresh weather from active provider
        const weatherData = await weatherService.getComprehensiveWeather(target.lat, target.lon, {
          locationName: target.name,
          bypassCache: true,
        });

        // Enrich with calculated freshness
        weatherData.metadata = enrichMetadataWithFreshness(weatherData.metadata);

        if (weatherData.metadata?.isStale) {
          failureCount++;
          logger.warn(`[WeatherWorker] Upstream provider offline for ${gridKey}; preserved valid cached snapshot.`);
          
          if (WeatherSnapshot?.db?.readyState === 1) {
            try {
              await WeatherSnapshot.findOneAndUpdate(
                { gridKey },
                {
                  $inc: { consecutiveFailures: 1 },
                  $set: {
                    providerStatus: 'OFFLINE',
                    'metadata.isStale': true,
                  },
                }
              );
            } catch (_) {}
          }
        } else {
          // 2. Persist latest valid snapshot in MongoDB if available
          if (WeatherSnapshot?.db?.readyState === 1) {
            try {
              await WeatherSnapshot.findOneAndUpdate(
                { gridKey },
                {
                  gridKey,
                  latitude: target.lat,
                  longitude: target.lon,
                  locationName: target.name,
                  timezone: weatherData.location?.timezone || 'UTC',
                  current: weatherData.current,
                  hourlyForecast: weatherData.hourlyForecast,
                  dailyForecast: weatherData.dailyForecast,
                  warnings: weatherData.warnings,
                  metadata: weatherData.metadata,
                  lastSuccessfulFetch: new Date(),
                  consecutiveFailures: 0,
                  providerStatus: 'HEALTHY',
                },
                { upsert: true, new: true }
              );
            } catch (dbErr) {
              logger.warn(`[WeatherWorker] MongoDB snapshot update warning for ${gridKey}: ${dbErr.message}`);
            }
          }
          successCount++;
        }

        // 3. Broadcast real-time Socket.IO update (if socket server initialized)
        if (socketService?.io && typeof socketService.broadcastWeatherUpdate === 'function') {
          socketService.broadcastWeatherUpdate({
            gridKey,
            location: weatherData.location,
            current: weatherData.current,
            warnings: weatherData.warnings,
            metadata: weatherData.metadata,
            timestamp: weatherData.timestamp,
          });
          if (typeof socketService.broadcastForecastUpdated === 'function') {
            socketService.broadcastForecastUpdated({
              gridKey,
              location: weatherData.location,
              current: weatherData.current,
              hourlyForecast: weatherData.hourlyForecast,
              dailyForecast: weatherData.dailyForecast,
              timestamp: weatherData.timestamp,
            });
          }
        }

        // Broadcast individual warnings if active
        if (Array.isArray(weatherData.warnings) && weatherData.warnings.length > 0) {
          // Process via Extreme Weather Alert Engine
          try {
            await extremeWeatherAlertEngine.processWarningFeed(weatherData.warnings, {
              locationName: target.name,
              latitude: target.lat,
              longitude: target.lon,
            });
          } catch (engineErr) {
            logger.warn(`[WeatherWorker] Extreme weather alert engine processing error: ${engineErr.message}`);
          }

          if (socketService?.io && typeof socketService.broadcastWeatherWarning === 'function') {
            for (const warning of weatherData.warnings) {
              socketService.broadcastWeatherWarning({
                gridKey,
                location: weatherData.location,
                warning,
              });
            }
          }
        }
      } catch (err) {
        failureCount++;
        logger.warn(`[WeatherWorker] Failed to ingest weather for target ${gridKey} (${target.name}): ${err.message}`);

        // Update failure state in MongoDB snapshot if available
        if (WeatherSnapshot?.db?.readyState === 1) {
          try {
            await WeatherSnapshot.findOneAndUpdate(
              { gridKey },
              {
                $inc: { consecutiveFailures: 1 },
                $set: {
                  providerStatus: 'OFFLINE',
                  'metadata.isStale': true,
                },
              }
            );
          } catch (_) {}
        }
      }
    }

    // 4. Update overall provider health & graceful recovery
    if (successCount > 0) {
      if (this.providerStatus === 'OFFLINE' || this.consecutiveFailures > 0) {
        logger.info(`[WeatherWorker] ✅ Provider health RECOVERED. Previous failures reset to 0.`);
      }
      this.providerStatus = 'HEALTHY';
      this.consecutiveFailures = 0;
      this.lastSuccessfulCycle = new Date().toISOString();
    } else if (failureCount > 0) {
      this.consecutiveFailures++;
      this.providerStatus = 'OFFLINE';
      logger.warn(`[WeatherWorker] ⚠️ Provider marked OFFLINE. Consecutive cycle failures: ${this.consecutiveFailures}`);
    }

    this.isCycleRunning = false;
    const summary = {
      timestamp: this.lastCycleTimestamp,
      targets: targets.length,
      successCount,
      failureCount,
      providerStatus: this.providerStatus,
      consecutiveFailures: this.consecutiveFailures,
    };
    logger.info(`[WeatherWorker] Ingestion cycle complete: ${successCount} ok, ${failureCount} failed.`);
    return summary;
  }

  /**
   * Start scheduled background ingestion worker
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info(`[WeatherWorker] 🚀 Background Weather Ingestion Worker started (Interval: ${Math.round(this.intervalMs / 1000)}s).`);

    // Immediate initial cycle
    this.runIngestionCycle().catch((err) => {
      logger.warn(`[WeatherWorker] Initial ingestion cycle notice: ${err.message}`);
    });

    // Scheduled periodic refresh
    this.timer = setInterval(() => {
      this.runIngestionCycle().catch((err) => {
        logger.warn(`[WeatherWorker] Periodic ingestion cycle notice: ${err.message}`);
      });
    }, this.intervalMs);

    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  /**
   * Stop background worker
   */
  stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    logger.info('[WeatherWorker] Background Weather Ingestion Worker stopped.');
  }

  /**
   * Return current worker telemetry
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      intervalMs: this.intervalMs,
      providerStatus: this.providerStatus,
      consecutiveFailures: this.consecutiveFailures,
      lastCycleTimestamp: this.lastCycleTimestamp,
      lastSuccessfulCycle: this.lastSuccessfulCycle,
      trackedLocationsCount: this.registeredLocations.size,
    };
  }
}

// Export singleton instance and class definition
const defaultWorker = new WeatherIngestionWorker();

module.exports = defaultWorker;
module.exports.WeatherIngestionWorker = WeatherIngestionWorker;
