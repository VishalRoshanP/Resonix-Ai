/**
 * RESONIX AI — Geospatial Mathematics & Cluster Geometry Engine
 * 
 * Deterministic geographic calculations for emergency operations:
 * - Spherical Haversine distance in meters
 * - Cluster centroid calculation
 * - Accurate GPS radius & report spread
 * - Geodesic circle polygon generation
 * - Minimum Spanning Tree (MST) for clean non-crossing connection lines
 * - Distance metrics for individual selected incidents
 * 
 * Strict Constraint: Pure deterministic mathematics. Zero AI / Zero LLM calls.
 */

const EARTH_RADIUS_METERS = 6371000;

/**
 * Deterministic Haversine distance in meters between two GPS coordinates
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number|null} Distance in meters (rounded to nearest integer)
 */
export function calculateHaversineDistanceMeters(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);
  if (isNaN(nLat1) || isNaN(nLon1) || isNaN(nLat2) || isNaN(nLon2)) return null;

  // Short-circuit for identical coordinates
  if (nLat1 === nLat2 && nLon1 === nLon2) return 0;

  const φ1 = (nLat1 * Math.PI) / 180;
  const φ2 = (nLat2 * Math.PI) / 180;
  const Δφ = ((nLat2 - nLat1) * Math.PI) / 180;
  const Δλ = ((nLon2 - nLon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(EARTH_RADIUS_METERS * c);
}

/**
 * Formats a distance in meters to a clean operational label (m or km)
 * @param {number} meters
 * @returns {string} e.g. "184 m", "1.2 km"
 */
export function formatDistance(meters) {
  if (meters == null || isNaN(meters)) return 'N/A';
  const m = Math.round(meters);
  if (m < 1000) {
    return `${m} m`;
  }
  const km = (m / 1000).toFixed(1);
  return `${km} km`;
}

/**
 * Calculates geographic centroid from an array of points { lat, lng }
 * @param {Array<{lat: number, lng: number}>} points
 * @returns {{lat: number, lng: number}|null}
 */
export function calculateClusterCentroid(points = []) {
  const valid = points.filter(
    (p) => p && typeof p.lat === 'number' && typeof p.lng === 'number' && !isNaN(p.lat) && !isNaN(p.lng)
  );
  if (valid.length === 0) return null;
  if (valid.length === 1) return { lat: valid[0].lat, lng: valid[0].lng };

  const sum = valid.reduce(
    (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
    { lat: 0, lng: 0 }
  );

  return {
    lat: Number((sum.lat / valid.length).toFixed(6)),
    lng: Number((sum.lng / valid.length).toFixed(6)),
  };
}

/**
 * Calculates GPS Radius (center to farthest report) and Report Spread (max pairwise distance)
 * @param {{lat: number, lng: number}} center
 * @param {Array<{lat: number, lng: number, id?: string}>} points
 * @returns {{radiusMeters: number, spreadMeters: number, farthestIncident: object|null}}
 */
export function calculateClusterRadiusAndSpread(center, points = []) {
  const valid = points.filter(
    (p) => p && typeof p.lat === 'number' && typeof p.lng === 'number' && !isNaN(p.lat) && !isNaN(p.lng)
  );

  if (!center || valid.length === 0) {
    return { radiusMeters: 50, spreadMeters: 0, farthestIncident: null };
  }

  // 1. Radius = max distance from center to any incident in cluster
  let maxRadiusMeters = 0;
  let farthestIncident = null;

  valid.forEach((pt) => {
    const dist = calculateHaversineDistanceMeters(center.lat, center.lng, pt.lat, pt.lng);
    if (dist != null && dist > maxRadiusMeters) {
      maxRadiusMeters = dist;
      farthestIncident = pt;
    }
  });

  // 2. Spread = max pairwise distance between any two incidents in cluster
  let maxSpreadMeters = 0;
  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      const dist = calculateHaversineDistanceMeters(valid[i].lat, valid[i].lng, valid[j].lat, valid[j].lng);
      if (dist != null && dist > maxSpreadMeters) {
        maxSpreadMeters = dist;
      }
    }
  }

  // Minimum visual radius threshold (at least 45m for single point or identical points)
  const effectiveRadius = Math.max(45, maxRadiusMeters);

  return {
    radiusMeters: effectiveRadius,
    spreadMeters: maxSpreadMeters,
    farthestIncident,
  };
}

/**
 * Generates a GeoJSON Polygon representing an exact geodesic circular buffer around a center coordinate
 * @param {number} centerLng
 * @param {number} centerLat
 * @param {number} radiusMeters
 * @param {number} [points=36]
 * @returns {object} GeoJSON Polygon geometry
 */
export function createGeodesicCirclePolygon(centerLng, centerLat, radiusMeters, points = 36) {
  const coords = [];
  const distanceRadians = radiusMeters / EARTH_RADIUS_METERS;
  const centerLatRad = (centerLat * Math.PI) / 180;
  const centerLngRad = (centerLng * Math.PI) / 180;

  for (let i = 0; i <= points; i++) {
    const bearing = (i * 2 * Math.PI) / points;
    const latRad = Math.asin(
      Math.sin(centerLatRad) * Math.cos(distanceRadians) +
        Math.cos(centerLatRad) * Math.sin(distanceRadians) * Math.cos(bearing)
    );
    const lngRad =
      centerLngRad +
      Math.atan2(
        Math.sin(bearing) * Math.sin(distanceRadians) * Math.cos(centerLatRad),
        Math.cos(distanceRadians) - Math.sin(centerLatRad) * Math.sin(latRad)
      );
    coords.push([(lngRad * 180) / Math.PI, (latRad * 180) / Math.PI]);
  }

  return {
    type: 'Polygon',
    coordinates: [coords],
  };
}

/**
 * Builds Minimum Spanning Tree (MST) connection lines for same-disaster cluster incidents.
 * Guarantees all N reports are connected with exactly N - 1 lines and ZERO crossings (no visual spaghetti).
 * 
 * @param {Array<object>} clusterIncidents
 * @returns {{lines: Array<object>, midpoints: Array<object>}}
 */
export function buildClusterMSTConnections(clusterIncidents = []) {
  const valid = clusterIncidents.filter(
    (inc) => inc && typeof inc.lat === 'number' && typeof inc.lng === 'number' && !isNaN(inc.lat) && !isNaN(inc.lng)
  );

  const n = valid.length;
  if (n < 2) {
    return { lines: [], midpoints: [] };
  }

  // 1. Calculate all pairwise edges
  const allEdges = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dist = calculateHaversineDistanceMeters(valid[i].lat, valid[i].lng, valid[j].lat, valid[j].lng);
      allEdges.push({
        i,
        j,
        dist: dist != null ? dist : 0,
      });
    }
  }

  // Sort edges by distance ascending (Kruskal's algorithm)
  allEdges.sort((a, b) => a.dist - b.dist);

  // 2. Disjoint Set Union (DSU)
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i) => {
    if (parent[i] === i) return i;
    parent[i] = find(parent[i]);
    return parent[i];
  };
  const union = (i, j) => {
    const rootI = find(i);
    const rootJ = find(j);
    if (rootI !== rootJ) {
      parent[rootI] = rootJ;
      return true;
    }
    return false;
  };

  const mstEdges = [];
  for (const edge of allEdges) {
    if (union(edge.i, edge.j)) {
      mstEdges.push(edge);
      if (mstEdges.length === n - 1) break;
    }
  }

  // 3. Convert MST edges into GeoJSON LineString features & midpoint label features
  const lines = [];
  const midpoints = [];

  mstEdges.forEach((edge, idx) => {
    const incA = valid[edge.i];
    const incB = valid[edge.j];
    const dist = edge.dist;
    const isCoincident = dist < 2;
    const distLabel = isCoincident ? '0 m — SAME LOCATION' : formatDistance(dist);

    const midLng = Number(((incA.lng + incB.lng) / 2).toFixed(6));
    const midLat = Number(((incA.lat + incB.lat) / 2).toFixed(6));

    // Only draw physical distance lines for actual distinct GPS locations (dist >= 2m)
    // Avoids drawing zero-length fake lines across identical coordinates
    if (!isCoincident) {
      lines.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [incA.lng, incA.lat],
            [incB.lng, incB.lat],
          ],
        },
        properties: {
          edgeId: `edge_${edge.i}_${edge.j}_${idx}`,
          distanceMeters: dist,
          distanceLabel: distLabel,
          category: incA.category || incB.category || 'GENERAL',
          fromId: incA.id || incA._id || incA.packetId,
          toId: incB.id || incB._id || incB.packetId,
        },
      });
    }

    midpoints.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [midLng, midLat],
      },
      properties: {
        labelId: `label_${edge.i}_${edge.j}_${idx}`,
        distanceMeters: dist,
        distanceLabel: distLabel,
        isCoincident,
      },
    });
  });

  return { lines, midpoints };
}

/**
 * Calculates incident-specific distance metrics relative to cluster center and sibling reports
 * @param {object} incident
 * @param {Array<object>} allClusterIncidents
 * @param {{lat: number, lng: number}} center
 * @returns {{distanceToCenterMeters: number|null, nearestDistanceMeters: number|null, farthestDistanceMeters: number|null}}
 */
export function calculateIncidentMetrics(incident, allClusterIncidents = [], center = null) {
  if (!incident || typeof incident.lat !== 'number' || typeof incident.lng !== 'number') {
    return { distanceToCenterMeters: null, nearestDistanceMeters: null, farthestDistanceMeters: null };
  }

  // Distance to cluster center
  let distanceToCenterMeters = null;
  if (center && typeof center.lat === 'number' && typeof center.lng === 'number') {
    distanceToCenterMeters = calculateHaversineDistanceMeters(center.lat, center.lng, incident.lat, incident.lng);
  }

  // Distances to sibling reports
  const incId = String(incident.id || incident._id || incident.packetId || '');
  const siblings = allClusterIncidents.filter((other) => {
    const oId = String(other.id || other._id || other.packetId || '');
    return oId !== incId && typeof other.lat === 'number' && typeof other.lng === 'number';
  });

  let nearestDistanceMeters = null;
  let farthestDistanceMeters = null;

  if (siblings.length > 0) {
    siblings.forEach((other) => {
      const d = calculateHaversineDistanceMeters(incident.lat, incident.lng, other.lat, other.lng);
      if (d != null) {
        if (nearestDistanceMeters === null || d < nearestDistanceMeters) {
          nearestDistanceMeters = d;
        }
        if (farthestDistanceMeters === null || d > farthestDistanceMeters) {
          farthestDistanceMeters = d;
        }
      }
    });
  }

  return {
    distanceToCenterMeters,
    nearestDistanceMeters,
    farthestDistanceMeters,
  };
}
