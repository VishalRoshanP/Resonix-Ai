/**
 * Weather Cache
 * 
 * High-performance in-memory cache for meteorological data.
 * Features:
 * - Spatial grid quantization (0.02° ~ 2.2km) to maximize cache hits across nearby devices
 * - Configurable TTL per query type
 * - Resilient stale-data fallback on upstream provider outage
 * - Automatic background purge to prevent memory leaks
 */

const GRID_PRECISION = 2; // 2 decimal places = ~1.1km - 2.2km grid cell

const DEFAULT_TTLS = {
  CURRENT: 10 * 60 * 1000,      // 10 minutes
  HOURLY: 30 * 60 * 1000,       // 30 minutes
  DAILY: 60 * 60 * 1000,        // 60 minutes
  WARNINGS: 15 * 60 * 1000,     // 15 minutes
  COMPREHENSIVE: 15 * 60 * 1000,// 15 minutes
  LOCATION: 24 * 60 * 60 * 1000,// 24 hours
  NWP_FORECAST: 3 * 60 * 60 * 1000, // 3 hours (matches 4x daily model runs)
  NWP_COMPARE: 3 * 60 * 60 * 1000,  // 3 hours
};

class WeatherCache {
  constructor(options = {}) {
    this.ttls = { ...DEFAULT_TTLS, ...(options.ttls || {}) };
    this.store = new Map();
    this.maxEntries = options.maxEntries || 1000;
    this.opCount = 0;
  }

  /**
   * Quantize coordinate to grid cell
   * @param {number} coord
   * @returns {number}
   */
  quantize(coord) {
    const factor = Math.pow(10, GRID_PRECISION);
    return Math.round(Number(coord) * factor) / factor;
  }

  /**
   * Build unified cache key
   * @param {string} type - CURRENT | HOURLY | DAILY | WARNINGS | COMPREHENSIVE | LOCATION
   * @param {number|string} latOrQuery
   * @param {number} [lon]
   * @returns {string}
   */
  buildKey(type, latOrQuery, lon) {
    if (type === 'LOCATION') {
      return `LOC:${String(latOrQuery).trim().toLowerCase()}`;
    }
    const qLat = this.quantize(latOrQuery);
    const qLon = this.quantize(lon);
    return `${type}:${qLat}:${qLon}`;
  }

  /**
   * Store item in cache
   * @param {string} type
   * @param {number|string} latOrQuery
   * @param {number|undefined} lon
   * @param {Object} data
   * @param {number} [customTtlMs]
   */
  set(type, latOrQuery, lon, data, customTtlMs) {
    if (!data) return;

    if (this.store.size >= this.maxEntries) {
      // Evict oldest entry
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) this.store.delete(oldestKey);
    }

    const key = this.buildKey(type, latOrQuery, lon);
    const ttl = customTtlMs || this.ttls[type] || this.ttls.CURRENT;
    const now = Date.now();

    this.store.set(key, {
      data,
      cachedAt: new Date(now).toISOString(),
      expiresAt: now + ttl,
      ttlSeconds: Math.round(ttl / 1000),
    });

    this.opCount++;
    if (this.opCount % 50 === 0) {
      this.sweep();
    }
  }

  /**
   * Get fresh cached item (returns null if expired or missing)
   * @param {string} type
   * @param {number|string} latOrQuery
   * @param {number} [lon]
   * @returns {Object|null}
   */
  get(type, latOrQuery, lon) {
    const key = this.buildKey(type, latOrQuery, lon);
    const entry = this.store.get(key);

    if (entry && Date.now() <= entry.expiresAt) {
      if (Array.isArray(entry.data)) {
        return [...entry.data];
      }
      return {
        ...entry.data,
        metadata: {
          ...(entry.data.metadata || {}),
          cachedAt: entry.cachedAt,
          isStale: false,
          ttlSeconds: entry.ttlSeconds,
        },
      };
    }

    // Nearby cache lookup: for coordinate queries, check if fresh entry exists within ~0.03° (~3.3km)
    if (type !== 'LOCATION' && lon !== undefined && !isNaN(Number(latOrQuery)) && !isNaN(Number(lon))) {
      const qLat = this.quantize(latOrQuery);
      const qLon = this.quantize(lon);
      const now = Date.now();
      const prefix = `${type}:`;

      for (const [k, e] of this.store.entries()) {
        if (k.startsWith(prefix) && now <= e.expiresAt) {
          const parts = k.split(':');
          if (parts.length >= 3) {
            const eLat = parseFloat(parts[1]);
            const eLon = parseFloat(parts[2]);
            if (!isNaN(eLat) && !isNaN(eLon) && Math.abs(eLat - qLat) <= 0.03 && Math.abs(eLon - qLon) <= 0.03) {
              if (Array.isArray(e.data)) return [...e.data];
              return {
                ...e.data,
                metadata: {
                  ...(e.data.metadata || {}),
                  cachedAt: e.cachedAt,
                  isStale: false,
                  ttlSeconds: e.ttlSeconds,
                },
              };
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Get stale item if present (used as fallback when live provider fails)
   * @param {string} type
   * @param {number|string} latOrQuery
   * @param {number} [lon]
   * @returns {Object|null}
   */
  getStale(type, latOrQuery, lon) {
    const key = this.buildKey(type, latOrQuery, lon);
    const entry = this.store.get(key);

    if (entry) {
      if (Array.isArray(entry.data)) {
        return [...entry.data];
      }
      return {
        ...entry.data,
        metadata: {
          ...(entry.data.metadata || {}),
          cachedAt: entry.cachedAt,
          isStale: true,
          ttlSeconds: entry.ttlSeconds,
          staleNotice: 'Served from resilient local cache during upstream provider outage.',
        },
      };
    }

    // Nearby stale fallback within ~0.05° (~5.5km)
    if (type !== 'LOCATION' && lon !== undefined && !isNaN(Number(latOrQuery)) && !isNaN(Number(lon))) {
      const qLat = this.quantize(latOrQuery);
      const qLon = this.quantize(lon);
      const prefix = `${type}:`;

      for (const [k, e] of this.store.entries()) {
        if (k.startsWith(prefix)) {
          const parts = k.split(':');
          if (parts.length >= 3) {
            const eLat = parseFloat(parts[1]);
            const eLon = parseFloat(parts[2]);
            if (!isNaN(eLat) && !isNaN(eLon) && Math.abs(eLat - qLat) <= 0.05 && Math.abs(eLon - qLon) <= 0.05) {
              if (Array.isArray(e.data)) return [...e.data];
              return {
                ...e.data,
                metadata: {
                  ...(e.data.metadata || {}),
                  cachedAt: e.cachedAt,
                  isStale: true,
                  ttlSeconds: e.ttlSeconds,
                  staleNotice: 'Served from nearby resilient local cache during upstream provider outage.',
                },
              };
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Check if cache has non-expired item
   * @param {string} type
   * @param {number|string} latOrQuery
   * @param {number} [lon]
   * @returns {boolean}
   */
  has(type, latOrQuery, lon) {
    return Boolean(this.get(type, latOrQuery, lon));
  }

  /**
   * Purge expired items
   */
  sweep() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      // Keep stale items up to 24 hours for disaster resilience
      if (now > entry.expiresAt + 24 * 60 * 60 * 1000) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Clear all cached entries
   */
  clear() {
    this.store.clear();
  }

  /**
   * Destroy sweep timer
   */
  destroy() {
    if (this.sweepInterval) {
      clearInterval(this.sweepInterval);
    }
    this.clear();
  }
}

// Export singleton instance and class
const defaultCache = new WeatherCache();

module.exports = defaultCache;
module.exports.WeatherCache = WeatherCache;
