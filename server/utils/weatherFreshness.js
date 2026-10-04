/**
 * Weather Freshness & Age Utility
 * 
 * Computes exact data age and human-readable freshness indicators
 * guaranteeing transparent reporting of live vs. stale meteorological data.
 */

/**
 * Calculate age in seconds and minutes from a timestamp
 * @param {string|number|Date} timestamp
 * @returns {{ ageSeconds: number, ageMinutes: number, ageHours: number }}
 */
function calculateAge(timestamp) {
  if (!timestamp) return { ageSeconds: 0, ageMinutes: 0, ageHours: 0 };
  const timeMs = new Date(timestamp).getTime();
  if (isNaN(timeMs)) return { ageSeconds: 0, ageMinutes: 0, ageHours: 0 };

  const diffMs = Math.max(0, Date.now() - timeMs);
  const ageSeconds = Math.floor(diffMs / 1000);
  const ageMinutes = Math.floor(ageSeconds / 60);
  const ageHours = Math.floor(ageMinutes / 60);

  return { ageSeconds, ageMinutes, ageHours };
}

/**
 * Format human-readable freshness string ("Updated X minutes ago" or "Cached X minutes ago")
 * @param {string|number|Date} timestamp
 * @param {boolean} [isCached=false]
 * @returns {string}
 */
function formatFreshness(timestamp, isCached = false) {
  const { ageSeconds, ageMinutes, ageHours } = calculateAge(timestamp);
  const prefix = isCached ? 'Cached' : 'Updated';

  if (ageSeconds < 45) {
    return `${prefix} just now`;
  }
  if (ageMinutes === 1) {
    return `${prefix} 1 minute ago`;
  }
  if (ageMinutes < 60) {
    return `${prefix} ${ageMinutes} minutes ago`;
  }
  if (ageHours === 1) {
    return `${prefix} 1 hour ago`;
  }
  if (ageHours < 24) {
    return `${prefix} ${ageHours} hours ago`;
  }
  const days = Math.floor(ageHours / 24);
  return `${prefix} ${days} day${days > 1 ? 's' : ''} ago`;
}

/**
 * Generate complete freshness metadata package
 * @param {Object} metadata - Existing weather metadata
 * @returns {Object} Enriched metadata with age and freshnessLabel
 */
function enrichMetadataWithFreshness(metadata = {}) {
  const isCached = Boolean(metadata.isCached);
  const isStale = Boolean(metadata.isStale);
  const refTime = metadata.cachedAt || metadata.sourceUpdateTime || new Date().toISOString();
  const { ageSeconds, ageMinutes, ageHours } = calculateAge(refTime);
  const freshnessLabel = formatFreshness(refTime, isCached || isStale);

  let statusBadge = isStale ? 'STALE' : (isCached ? 'CACHED' : (ageMinutes < 15 ? 'LIVE' : 'CACHED'));
  let statusText = isStale
    ? `Cached (Provider offline) • ${freshnessLabel}`
    : (statusBadge === 'LIVE' ? `Live • ${freshnessLabel}` : freshnessLabel);

  return {
    ...metadata,
    isCached,
    ageSeconds,
    ageMinutes,
    ageHours,
    freshnessLabel,
    statusBadge,
    statusText,
    isStale,
  };
}

module.exports = {
  calculateAge,
  formatFreshness,
  enrichMetadataWithFreshness,
};
