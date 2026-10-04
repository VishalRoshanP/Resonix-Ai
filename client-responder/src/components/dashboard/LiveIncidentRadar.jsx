import { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
import Card from '../ui/Card';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  normalizeDisasterCategory,
  DISASTER_TYPES,
  DISASTER_CONFIGS,
  createDisasterStyleImage,
  createClusterCenterStyleImage,
  createSosAttentionStyleImage,
  getSosAttentionImageId,
  getCompactClusterLabel,
} from './disasterMapVisuals';
import {
  calculateHaversineDistanceMeters,
  formatDistance,
  calculateClusterCentroid,
  calculateClusterRadiusAndSpread,
  createGeodesicCirclePolygon,
  buildClusterMSTConnections,
  calculateIncidentMetrics,
} from '../../utils/geoClusterMath';
import { isIncidentActive } from '../../utils/helpers';
import {
  normalizeIncidentForMap,
  calculateClusterComposition,
  getIncidentCategoryStyle,
  getAuthoritativeIncidentCategory,
  doIncidentsMatch,
  getIncidentIdentifiers,
} from '../../utils/mapIncidentNormalizer';

// Priority color mapping for WebGL circle layers
const PRIORITY_COLORS = {
  CRITICAL: '#ef4444',   // red-500
  ATTENTION: '#f59e0b',  // amber-500
  MONITORING: '#38bdf8', // sky-400
  RESOLVED: '#10b981',   // emerald-500
};

/**
 * Strips raw coordinates from presentation when not needed
 */
function cleanLocationName(locStr) {
  if (!locStr || typeof locStr !== 'string') return 'Salem';
  const trimmed = locStr.trim();
  if (trimmed.startsWith('GPS:') || trimmed.includes('° N') || /^\d+\.\d+,\s*\d+\.\d+$/.test(trimmed)) {
    return 'Salem Operational Area';
  }
  return trimmed;
}

function LiveIncidentRadar({
  incidents = [],
  clusters = [],
  focusTarget = null,
  onSelectIncident,
  onSelectCluster,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const mapLoadedRef = useRef(false);
  const hasInitialFitRef = useRef(false);
  const notifiedCriticalIdsRef = useRef(new Set());
  const notificationTimerRef = useRef(null);
  const seenIncidentIdsRef = useRef(new Set());
  const hasInitializedSeenRef = useRef(false);
  const activeAttentionFeaturesRef = useRef(new Map());
  const popupRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const focusTargetRef = useRef(focusTarget);
  focusTargetRef.current = focusTarget;

  const [newIncidentNotification, setNewIncidentNotification] = useState(null);
  const [focusedIncidentId, setFocusedIncidentId] = useState(null);
  const [showClusters, setShowClusters] = useState(true);
  const [mapError, setMapError] = useState(null);

  // Phase 10: State for distance labels and interactive operational HUDs
  const [showDistanceLabels, setShowDistanceLabels] = useState(true);
  const [selectedIncidentData, setSelectedIncidentData] = useState(null);
  const [selectedClusterData, setSelectedClusterData] = useState(null);

  // Filter multi-citizen clusters with 2+ reports
  const multiCitizenClusters = useMemo(() => {
    if (!Array.isArray(clusters)) return [];
    return clusters.filter((c) => c.reportCount >= 2 && c.center?.lat && c.center?.lng);
  }, [clusters]);

  // Map priority strings to 3 strict levels required + stable resolved state:
  // 🔴 Critical | 🟠 Attention | 🔵 Monitoring | ✓ Resolved
  const getRadarPriority = (inc) => {
    const st = (inc.status || inc.packetStatus || '').toUpperCase();
    if (['RESOLVED', 'CLOSED', 'COMPLETED'].includes(st)) {
      return {
        level: 'RESOLVED',
        color: 'text-emerald-400 bg-emerald-500/20 border-emerald-500 shadow-emerald-500/20',
        badgeColor: 'bg-emerald-600 text-white',
        dotColor: 'bg-emerald-500',
        ringStyle: 'ring-1 ring-emerald-500/40',
        iconEmoji: '✓',
        label: 'Resolved',
      };
    }

    const p = (inc.severity || inc.priority || inc.aiAnalysis?.severity || inc.aiAnalysis?.priority || 'MEDIUM').toUpperCase();
    if (p === 'CRITICAL' || p === 'LEVEL_4' || p === 'LEVEL_5') {
      return {
        level: 'CRITICAL',
        color: 'text-error bg-error/20 border-error shadow-error/40',
        badgeColor: 'bg-error text-white',
        dotColor: 'bg-error animate-ping',
        ringStyle: 'ring-4 ring-error/40 animate-pulse',
        iconEmoji: '🔴',
        label: 'Critical',
      };
    }
    if (p === 'HIGH' || p === 'WARNING' || p === 'MODERATE') {
      return {
        level: 'ATTENTION',
        color: 'text-amber-500 bg-amber-500/20 border-amber-500 shadow-amber-500/30',
        badgeColor: 'bg-amber-500 text-white',
        dotColor: 'bg-amber-500',
        ringStyle: 'ring-2 ring-amber-500/30 shadow-md shadow-amber-500/20',
        iconEmoji: '🟠',
        label: 'Attention',
      };
    }
    return {
      level: 'MONITORING',
      color: 'text-sky-400 bg-sky-500/20 border-sky-400 shadow-sky-500/20',
      badgeColor: 'bg-sky-500 text-white',
      dotColor: 'bg-sky-400',
      ringStyle: 'ring-1 ring-sky-400/40',
      iconEmoji: '🔵',
      label: 'Monitoring',
    };
  };

  // Helper for time ago display
  const getTimeAgo = (timestamp) => {
    if (!timestamp) return 'Recent';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'Recent';
    const diffMins = Math.max(1, Math.floor((Date.now() - date.getTime()) / 60000));
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h ago`;
  };

  // Process & Project REAL Incidents to GPS Coordinates from Backend
  // Process & Project REAL Incidents to GPS Coordinates from Backend
  const radarIncidents = useMemo(() => {
    if (!incidents || incidents.length === 0) return [];

    // Deduplicate so 1 real incident = 1 map marker (never duplicate across ID variants)
    const uniqueIncidents = [];
    incidents.forEach((rawInc) => {
      if (!rawInc || !isIncidentActive(rawInc)) return;

      const existingIndex = uniqueIncidents.findIndex((item) => doIncidentsMatch(item, rawInc));
      if (existingIndex !== -1) {
        // Merge newest properties in place (preserve most up-to-date AI enrichment)
        uniqueIncidents[existingIndex] = { ...uniqueIncidents[existingIndex], ...rawInc };
      } else {
        uniqueIncidents.push(rawInc);
      }
    });

    return uniqueIncidents
      .map((inc) => {
        const normalized = normalizeIncidentForMap(inc);
        if (!normalized) return null;

        const priorityInfo = getRadarPriority(normalized);
        const timeAgo = getTimeAgo(normalized.timestamp);

        return {
          ...normalized,
          priorityInfo,
          timeAgo,
        };
      })
      .filter(Boolean);
  }, [incidents]);

  // Ribbon Recent Incidents List (Top 5 Active Only)
  const recentRibbonIncidents = useMemo(() => {
    return radarIncidents.slice(0, 5);
  }, [radarIncidents]);

  // Phase 10 & Visual Refinement: Deterministic Geospatial Cluster Geometry, MST & Leader Lines
  // ACTIVE INCIDENTS ONLY: Excludes resolved incidents BEFORE computing centroid, radius, spread, MST, and affected area
  const clusterGeometryData = useMemo(() => {
    if (!showClusters || multiCitizenClusters.length === 0) {
      return {
        areasGeoJSON: { type: 'FeatureCollection', features: [] },
        connectionsGeoJSON: { type: 'FeatureCollection', features: [] },
        distanceLabelsGeoJSON: { type: 'FeatureCollection', features: [] },
        clusterCentersGeoJSON: { type: 'FeatureCollection', features: [] },
        leaderLinesGeoJSON: { type: 'FeatureCollection', features: [] },
        enrichedClusters: [],
        memberBadgesMap: new Map(),
      };
    }

    const areaFeatures = [];
    const connectionFeatures = [];
    const distanceLabelFeatures = [];
    const centerFeatures = [];
    const leaderFeatures = [];
    const enrichedClusters = [];
    const memberBadgesMap = new Map();

    const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    multiCitizenClusters.forEach((cluster, idx) => {
      // Find actual active member incidents (radarIncidents is already strictly active)
      const clusterIncidentIds = Array.isArray(cluster.incidentIds) ? cluster.incidentIds : [];
      let memberIncidents = radarIncidents.filter((inc) => {
        const incAllIds = [
          inc.incidentId,
          inc.radarId,
          inc._id,
          inc.id,
          inc.packetId,
          inc.incident_id,
          inc.clientRequestId,
        ].filter(Boolean).map(String);

        const idMatch = clusterIncidentIds.some((cid) => {
          const sCid = String(cid);
          return incAllIds.some((id) => sCid === id || sCid.endsWith(id) || id.endsWith(sCid));
        });
        if (idMatch) return true;

        if (Array.isArray(cluster.incidents)) {
          return cluster.incidents.some((ci) => {
            const ciIds = [ci._id, ci.id, ci.incidentId, ci.packetId, ci.clientRequestId].filter(Boolean).map(String);
            return ciIds.some((cid) => incAllIds.some((id) => cid === id || cid.endsWith(id) || id.endsWith(cid)));
          });
        }
        return false;
      });

      // Fallback if IDs were not populated or mismatch: match by distance to cluster.center
      if (memberIncidents.length < 2 && cluster.center?.lat && cluster.center?.lng) {
        const dominantHazard = normalizeDisasterCategory(cluster.dominantHazard || 'GENERAL');
        const maxDist = Math.max(cluster.spreadMeters || 1000, 2500);
        memberIncidents = radarIncidents.filter((inc) => {
          if (inc.disasterType !== dominantHazard && inc.category !== dominantHazard) return false;
          const d = calculateHaversineDistanceMeters(cluster.center.lat, cluster.center.lng, inc.lat, inc.lng);
          return d !== null && d <= maxDist;
        });
      }

      // If fewer than 2 active incidents remain in this cluster,
      // it NO LONGER meets the cluster threshold; skip cluster rendering
      if (memberIncidents.length < 2) {
        return;
      }

      const composition = calculateClusterComposition(memberIncidents);
      const dominantHazard = composition.dominantCategory;
      const priority = (cluster.priority || 'HIGH').toUpperCase();
      const groupName = composition.groupTitle;

      // 1. Mathematically derived centroid strictly from active member coordinates
      const calculatedCentroid = calculateClusterCentroid(memberIncidents);
      if (!calculatedCentroid || isNaN(calculatedCentroid.lat) || isNaN(calculatedCentroid.lng)) {
        return;
      }

      // 2. Exact GPS Radius & Spread strictly from active member coordinates
      const { radiusMeters, spreadMeters, farthestIncident } = calculateClusterRadiusAndSpread(
        calculatedCentroid,
        memberIncidents
      );

      const formattedRadius = formatDistance(radiusMeters);
      const formattedSpread = formatDistance(spreadMeters);

      // Assign deterministic report letters (A, B, C, D...) to each member incident
      memberIncidents.forEach((member, mIdx) => {
        const badgeLetter = LETTERS[mIdx % LETTERS.length];
        const mAllIds = [
          member.incidentId,
          member.radarId,
          member._id,
          member.id,
          member.packetId,
          member.incident_id,
          member.clientRequestId,
        ].filter(Boolean).map(String);
        mAllIds.forEach((id) => {
          memberBadgesMap.set(id, {
            badge: badgeLetter,
            clusterId: cluster.clusterId || `cluster_${idx}`,
            clusterIndex: idx,
            indexInCluster: mIdx + 1,
          });
        });
      });

      // 3. Geodesic Circle Polygon for Affected Area (Subtle supporting context)
      const displayRadiusMeters = Math.max(50, radiusMeters);
      const polygonGeom = createGeodesicCirclePolygon(
        calculatedCentroid.lng,
        calculatedCentroid.lat,
        displayRadiusMeters,
        48
      );

      areaFeatures.push({
        type: 'Feature',
        geometry: polygonGeom,
        properties: {
          clusterIndex: idx,
          clusterId: cluster.clusterId || `cluster_${idx}`,
          dominantHazard,
          priority,
          groupName,
          radiusMeters,
          formattedRadius,
          spreadMeters,
          formattedSpread,
          reportCount: memberIncidents.length,
          isMixed: composition.isMixed,
          breakdownSummary: composition.breakdownSummary,
        },
      });

      // 4. Minimum Spanning Tree (MST) connections strictly for active member incidents
      const { lines, midpoints } = buildClusterMSTConnections(memberIncidents);
      lines.forEach((l) => {
        connectionFeatures.push({
          ...l,
          properties: {
            ...l.properties,
            clusterId: cluster.clusterId || `cluster_${idx}`,
            dominantHazard,
          },
        });
      });

      if (showDistanceLabels) {
        midpoints.forEach((m) => {
          distanceLabelFeatures.push({
            ...m,
            properties: {
              ...m.properties,
              clusterId: cluster.clusterId || `cluster_${idx}`,
            },
          });
        });
      }

      // 5. Cluster Leader Line (Connects centroid "+" up to elevated cluster label)
      // Offsets north so the cluster label NEVER overlaps the actual incident markers
      const offsetLatDegrees = Math.max((displayRadiusMeters / 111320) * 1.05, 0.0014);
      const leaderTopLat = Number((calculatedCentroid.lat + offsetLatDegrees).toFixed(6));
      const leaderTopLng = calculatedCentroid.lng;

      leaderFeatures.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [calculatedCentroid.lng, calculatedCentroid.lat],
            [leaderTopLng, leaderTopLat],
          ],
        },
        properties: {
          clusterId: cluster.clusterId || `cluster_${idx}`,
          dominantHazard,
        },
      });

      // 6. Cluster centroid point ("+" indicator, subtle, distinctly non-incident)
      const centerIcon = `cluster-center-${dominantHazard.toLowerCase()}`;
      const centerLabel = composition.isMixed
        ? `+ Mixed Center (${formattedRadius})`
        : `+ ${composition.dominantStyle.label} Center (${formattedRadius})`;

      centerFeatures.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [calculatedCentroid.lng, calculatedCentroid.lat],
        },
        properties: {
          clusterIndex: idx,
          clusterId: cluster.clusterId || `cluster_${idx}`,
          dominantHazard,
          centerIcon,
          labelText: centerLabel,
        },
      });

      const enriched = {
        ...cluster,
        centroid: calculatedCentroid,
        leaderTopLat,
        leaderTopLng,
        memberIncidents,
        reportCount: memberIncidents.length,
        radiusMeters,
        formattedRadius,
        spreadMeters,
        formattedSpread,
        farthestIncident,
        dominantHazard,
        groupName,
        composition,
      };
      enrichedClusters.push(enriched);
    });

    return {
      areasGeoJSON: { type: 'FeatureCollection', features: areaFeatures },
      connectionsGeoJSON: { type: 'FeatureCollection', features: connectionFeatures },
      distanceLabelsGeoJSON: { type: 'FeatureCollection', features: distanceLabelFeatures },
      clusterCentersGeoJSON: { type: 'FeatureCollection', features: centerFeatures },
      leaderLinesGeoJSON: { type: 'FeatureCollection', features: leaderFeatures },
      enrichedClusters,
      memberBadgesMap,
    };
  }, [radarIncidents, multiCitizenClusters, showClusters, showDistanceLabels]);

  // Convert radarIncidents to GeoJSON FeatureCollection for MapLibre source
  // Evaluates AFTER clusterGeometryData to inject deterministic report badges (A, B, C, D...)
  const incidentsGeoJSON = useMemo(() => {
    // Detect coincident incidents sharing identical coordinates (< 5m)
    const locationBuckets = new Map();
    radarIncidents.forEach((item) => {
      const key = `${item.lat.toFixed(5)},${item.lng.toFixed(5)}`;
      if (!locationBuckets.has(key)) locationBuckets.set(key, []);
      locationBuckets.get(key).push(item);
    });

    return {
      type: 'FeatureCollection',
      features: radarIncidents.map((item, idx) => {
        const disasterType = item.disasterType || normalizeDisasterCategory(item.category);
        const isCritical = item.priorityInfo?.level === 'CRITICAL';
        const disasterIcon = isCritical
          ? `disaster-${disasterType.toLowerCase()}-critical`
          : `disaster-${disasterType.toLowerCase()}`;

        const coordKey = `${item.lat.toFixed(5)},${item.lng.toFixed(5)}`;
        const atSameLoc = locationBuckets.get(coordKey) || [item];
        const isCoincident = atSameLoc.length > 1;
        const coincidentCount = atSameLoc.length;
        const locIndex = atSameLoc.indexOf(item);

        // Subtle visual vertical marker stacking ONLY when multiple real reports share the exact same coordinates
        // True stored GPS coordinates [item.lng, item.lat] are NEVER modified!
        const iconOffsetY = isCoincident
          ? Math.round((locIndex - (coincidentCount - 1) / 2) * 16)
          : 0;

        // Retrieve report badge letter (A, B, C...) if this incident belongs to a cluster
        const badgeInfo =
          clusterGeometryData.memberBadgesMap?.get(String(item.incidentId)) ||
          clusterGeometryData.memberBadgesMap?.get(String(item.radarId)) ||
          clusterGeometryData.memberBadgesMap?.get(String(item._id)) ||
          clusterGeometryData.memberBadgesMap?.get(String(item.packetId)) ||
          null;

        const rawId = String(item.incidentId || item.packetId || item._id || '');
        const shortId = rawId.length > 8 ? `INC-${rawId.slice(-4).toUpperCase()}` : (rawId || 'INC');

        // Badge display:
        // If coincident and last in stack: show compact count indicator badge
        // Otherwise show cluster letter badge (A, B, C...)
        let reportBadge = '';
        let badgeOffset = [1.2, -0.6];
        if (isCoincident) {
          if (locIndex === coincidentCount - 1) {
            reportBadge = String(coincidentCount);
            badgeOffset = [1.2, -0.6];
          }
        } else if (badgeInfo) {
          reportBadge = badgeInfo.badge;
          badgeOffset = [1.2, -0.6];
        }

        const inCluster = Boolean(badgeInfo);

        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [item.lng, item.lat],
          },
          properties: {
            incidentIndex: idx,
            incidentId: item.incidentId,
            shortId,
            category: item.category,
            disasterType: disasterType,
            disasterIcon: disasterIcon,
            isCritical: isCritical,
            priority: item.priority,
            priorityLevel: item.priorityInfo?.level || 'MONITORING',
            priorityScore: isCritical ? 1 : (item.priorityInfo?.level === 'ATTENTION' ? 2 : 3),
            status: item.status,
            locationStr: item.locationStr,
            affectedPeople: item.affectedPeople,
            timeAgo: item.timeAgo,
            timestamp: item.timestamp,
            reportBadge: reportBadge,
            isCoincident: isCoincident,
            coincidentCount: coincidentCount,
            inCluster: inCluster,
            iconOffset: [0, iconOffsetY],
            badgeOffset: badgeOffset,
            categoryConflict: Boolean(item.categoryConflict),
            aiPending: Boolean(item.aiPending),
          },
        };
      }),
    };
  }, [radarIncidents, clusterGeometryData.memberBadgesMap]);

  // Convert active fusion clusters to GeoJSON FeatureCollection with elevated non-overlapping labels
  // Positioned at top of leader line so cluster text never obscures the real GPS incident markers below
  const fusionClustersGeoJSON = useMemo(() => {
    if (!showClusters || clusterGeometryData.enrichedClusters.length === 0) {
      return { type: 'FeatureCollection', features: [] };
    }
    return {
      type: 'FeatureCollection',
      features: clusterGeometryData.enrichedClusters.map((cluster, idx) => {
        const dominantHazard = cluster.dominantHazard || normalizeDisasterCategory(cluster.dominantHazard || 'GENERAL');
        const priority = (cluster.priority || 'HIGH').toUpperCase();
        const compactLabel = cluster.composition?.compactLabel || getCompactClusterLabel(dominantHazard, cluster.reportCount, priority, cluster.composition);
        const priorityScore = priority === 'CRITICAL' ? 1 : (priority === 'HIGH' ? 2 : 3);
        const groupName = cluster.groupName || `${dominantHazard} CLUSTER`;
        const isHighDensity = Boolean(cluster.densityInfo?.isHighDensity || cluster.densityInfo?.densityLevel === 'HIGH');
        const isMixed = Boolean(cluster.composition?.isMixed);
        const breakdownSummary = cluster.composition?.breakdownSummary || '';
        const countStr = String(cluster.reportCount);
        const clusterColor = DISASTER_CONFIGS[dominantHazard]?.color || '#ef4444';
        const isCritical = priority === 'CRITICAL';
        const clusterShortLabel = isMixed ? 'MIXED' : dominantHazard;
        const dominantEmoji = DISASTER_CONFIGS[dominantHazard]?.emoji || '🚨';

        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [cluster.centroid.lng, cluster.centroid.lat],
          },
          properties: {
            clusterIndex: idx,
            clusterId: cluster.clusterId || `cluster_${idx}`,
            dominantHazard,
            compactLabel,
            groupName,
            priority,
            priorityScore,
            reportCount: cluster.reportCount,
            countStr,
            clusterColor,
            isCritical,
            clusterShortLabel,
            dominantEmoji,
            isMixed,
            breakdownSummary,
            categoryBreakdown: cluster.composition?.counts ? JSON.stringify(cluster.composition.counts) : '',
            criticalCount: cluster.criticalCount || cluster.memberIncidents?.filter(i => i.priorityInfo?.level === 'CRITICAL').length || 0,
            highPriorityCount: cluster.highPriorityCount || cluster.memberIncidents?.filter(i => i.priorityInfo?.level === 'ATTENTION').length || 0,
            activeCount: cluster.reportCount,
            completedCount: 0,
            isHighDensity,
            densityLevel: cluster.densityInfo?.densityLevel || 'STANDARD',
            densityLabel: cluster.densityInfo?.densityLabel || 'STANDARD DENSITY',
            spreadMeters: cluster.spreadMeters || 100,
            estimatedRadiusKm: cluster.estimatedRadiusKm || '',
            estimatedAreaKm2: cluster.estimatedAffectedAreaKm2 || cluster.estimatedReportingAreaKm2 || 0,
          },
        };
      }),
    };
  }, [clusterGeometryData.enrichedClusters, showClusters]);

  // Selected Incident GeoJSON for highlight ring
  const selectedIncidentGeoJSON = useMemo(() => {
    if (!selectedIncidentData || typeof selectedIncidentData.lng !== 'number' || typeof selectedIncidentData.lat !== 'number') {
      return { type: 'FeatureCollection', features: [] };
    }
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [selectedIncidentData.lng, selectedIncidentData.lat],
          },
          properties: {
            incidentId: selectedIncidentData.incidentId,
          },
        },
      ],
    };
  }, [selectedIncidentData]);

  // Stable callback refs for event handlers to avoid re-attaching
  const radarIncidentsRef = useRef(radarIncidents);
  radarIncidentsRef.current = radarIncidents;

  const multiCitizenClustersRef = useRef(multiCitizenClusters);
  multiCitizenClustersRef.current = multiCitizenClusters;

  const clusterGeometryDataRef = useRef(clusterGeometryData);
  clusterGeometryDataRef.current = clusterGeometryData;

  const incidentsGeoJSONRef = useRef(incidentsGeoJSON);
  incidentsGeoJSONRef.current = incidentsGeoJSON;

  const fusionClustersGeoJSONRef = useRef(fusionClustersGeoJSON);
  fusionClustersGeoJSONRef.current = fusionClustersGeoJSON;

  const selectedIncidentGeoJSONRef = useRef(selectedIncidentGeoJSON);
  selectedIncidentGeoJSONRef.current = selectedIncidentGeoJSON;

  const onSelectIncidentRef = useRef(onSelectIncident);
  onSelectIncidentRef.current = onSelectIncident;

  const onSelectClusterRef = useRef(onSelectCluster);
  onSelectClusterRef.current = onSelectCluster;

  // Deterministic incident selection and metric enrichment helper
  const selectIncidentTarget = useCallback((target) => {
    if (!target) return;
    const targetLng = Number(target.lng);
    const targetLat = Number(target.lat);
    const targetId = target.incidentId ? String(target.incidentId).toLowerCase() : null;

    // Search in radarIncidents
    const found = radarIncidentsRef.current.find((inc) => {
      if (targetId) {
        const iId = String(inc.incidentId || '').toLowerCase();
        const rId = String(inc.rawId || '').toLowerCase();
        const sId = String(inc.shortId || '').toLowerCase();
        const pId = String(inc.packetId || '').toLowerCase();
        if (iId === targetId || rId === targetId || sId === targetId || pId === targetId) return true;
        if (targetId.startsWith('inc-')) {
          const suffix = targetId.replace('inc-', '');
          if (iId.endsWith(suffix) || rId.endsWith(suffix) || pId.endsWith(suffix)) return true;
        }
      }
      if (!isNaN(targetLat) && !isNaN(targetLng) && typeof inc.lat === 'number' && typeof inc.lng === 'number') {
        const d = calculateHaversineDistanceMeters(targetLat, targetLng, inc.lat, inc.lng);
        if (d != null && d < 10) return true;
      }
      return false;
    });

    const incidentData = found || (targetLat && targetLng ? {
      incidentId: target.incidentId || 'INC-TARGET',
      lat: targetLat,
      lng: targetLng,
      category: target.category || 'GENERAL',
      priority: target.priority || 'HIGH',
      status: target.status || 'ACTIVE',
      accuracy: target.accuracy || null,
      radarId: `target_${Date.now()}`,
    } : null);

    if (!incidentData) return;

    // Detect coincident incidents
    const coincidentIncidents = radarIncidentsRef.current.filter((inc) => {
      if (typeof inc.lat !== 'number' || typeof inc.lng !== 'number') return false;
      const d = calculateHaversineDistanceMeters(incidentData.lat, incidentData.lng, inc.lat, inc.lng);
      return d !== null && d <= 5;
    });

    // Find containing cluster
    const currentCluster = clusterGeometryDataRef.current?.enrichedClusters?.find((c) =>
      c.memberIncidents?.some((m) => m.incidentId === incidentData.incidentId)
    );

    const metrics = calculateIncidentMetrics(
      incidentData,
      currentCluster ? currentCluster.memberIncidents : [],
      currentCluster ? currentCluster.centroid : null
    );

    const accuracyStr = incidentData.accuracy != null
      ? `±${Math.round(incidentData.accuracy)} m`
      : 'GPS accuracy: unavailable';

    const rawId = String(incidentData.incidentId || incidentData.incident_id || incidentData.packetId || '');
    const shortId = target.displayId || (rawId.length > 8 ? `INC-${rawId.slice(-4).toUpperCase()}` : (rawId || 'INC-LIVE'));

    // Nearby sibling reports in same cluster with deterministic distances
    const siblingDistances = currentCluster?.memberIncidents
      ?.filter((m) => m.incidentId !== incidentData.incidentId && typeof m.lat === 'number' && typeof m.lng === 'number')
      ?.map((m) => {
        const d = calculateHaversineDistanceMeters(incidentData.lat, incidentData.lng, m.lat, m.lng);
        const sibRawId = String(m.incidentId || m.incident_id || m.packetId || '');
        const sibShortId = sibRawId.length > 8 ? `INC-${sibRawId.slice(-4).toUpperCase()}` : (sibRawId || 'INC-LIVE');
        return {
          id: m.incidentId,
          shortId: sibShortId,
          category: m.category,
          distanceMeters: d,
          formattedDist: formatDistance(d),
        };
      })
      ?.sort((a, b) => (a.distanceMeters ?? 999999) - (b.distanceMeters ?? 999999))
      ?.slice(0, 4) || [];

    setSelectedIncidentData({
      ...incidentData,
      shortId,
      siblingDistances,
      metrics,
      accuracyStr,
      coincidentIncidents,
      clusterInfo: currentCluster
        ? {
            groupName: currentCluster.groupName || `${currentCluster.dominantHazard} CLUSTER`,
            reportCount: currentCluster.memberIncidents?.length || currentCluster.reportCount,
            radius: currentCluster.formattedRadius,
            spread: currentCluster.formattedSpread,
          }
        : null,
    });

    setFocusedIncidentId(incidentData.radarId);
  }, []);

  // Initialize MapLibre GL JS map instance ONCE
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    try {
      // Calculate dynamic initial center from active incidents if available (prevents hardcoded all-India zoom-out)
      let initialCenter = [78.9629, 20.5937];
      let initialZoom = 4;

      // PERF FIX: If a focusTarget is already pending (e.g. navigated from Incidents page),
      // start the map directly at the target coordinates instead of the all-India default.
      // This eliminates the visible flyTo animation delay after location navigation.
      const pendingFocus = focusTargetRef.current;
      const pendingFocusLat = pendingFocus?.lat ?? pendingFocus?.latitude;
      const pendingFocusLng = pendingFocus?.lng ?? pendingFocus?.longitude;
      const hasPendingFocus =
        pendingFocusLat != null &&
        pendingFocusLng != null &&
        !isNaN(Number(pendingFocusLat)) &&
        !isNaN(Number(pendingFocusLng));

      if (hasPendingFocus) {
        // Start map directly at target — no flyTo overhead
        initialCenter = [Number(pendingFocusLng), Number(pendingFocusLat)];
        initialZoom = pendingFocus.zoom || 16;
      } else {
        const validInitCoords = (incidents || [])
          .map((i) => {
            const lat = i.location?.lat ?? i.lat ?? i.rawDoc?.location?.lat;
            const lng = i.location?.lng ?? i.lng ?? i.rawDoc?.location?.lng;
            return { lat: Number(lat), lng: Number(lng) };
          })
          .filter((c) => typeof c.lat === 'number' && typeof c.lng === 'number' && !isNaN(c.lat) && !isNaN(c.lng) && c.lat !== 0 && c.lng !== 0);

        if (validInitCoords.length === 1) {
          initialCenter = [validInitCoords[0].lng, validInitCoords[0].lat];
          initialZoom = 14;
        } else if (validInitCoords.length > 1) {
          const lngs = validInitCoords.map((c) => c.lng);
          const lats = validInitCoords.map((c) => c.lat);
          const minLng = Math.min(...lngs);
          const maxLng = Math.max(...lngs);
          const minLat = Math.min(...lats);
          const maxLat = Math.max(...lats);
          const dLng = maxLng - minLng;
          const dLat = maxLat - minLat;

          initialCenter = [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
          if (dLng < 0.05 && dLat < 0.05) {
            initialZoom = 14;
          } else if (dLng < 0.5 && dLat < 0.5) {
            initialZoom = 11;
          } else if (dLng < 3.0 && dLat < 3.0) {
            initialZoom = 8.5;
          } else {
            initialZoom = 6.8;
          }
        }
      }

      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: {
          version: 8,
          sources: {
            'osm-tiles': {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | RESONIX AI Live Emergency System',
            },
          },
          layers: [
            {
              id: 'osm-tiles',
              type: 'raster',
              source: 'osm-tiles',
              minzoom: 0,
              maxzoom: 19,
            },
          ],
        },
        center: initialCenter,
        zoom: initialZoom,
        attributionControl: true,
        maxZoom: 18,
        minZoom: 2,
        cooperativeGestures: true,
      });

      // Create reusable popup (single instance for all markers)
      popupRef.current = new maplibregl.Popup({
        closeButton: true,
        closeOnClick: true,
        maxWidth: '280px',
        offset: 14,
      });

      map.on('load', () => {
        mapLoadedRef.current = true;

        // ══════════════════════════════════════════════
        // REGISTER DISASTER ANIMATED TEXTURES (WebGL)
        // ══════════════════════════════════════════════
        DISASTER_TYPES.forEach((type) => {
          const iconId = `disaster-${type.toLowerCase()}`;
          if (!map.hasImage(iconId)) {
            map.addImage(iconId, createDisasterStyleImage(map, type, false), { pixelRatio: 2 });
          }
          if (type !== 'RESOLVED') {
            const critIconId = `disaster-${type.toLowerCase()}-critical`;
            if (!map.hasImage(critIconId)) {
              map.addImage(critIconId, createDisasterStyleImage(map, type, true), { pixelRatio: 2 });
            }
          }

          // Subtle "+" crosshair style image for cluster center (never confused with incident)
          const crossId = `cluster-center-${type.toLowerCase()}`;
          if (!map.hasImage(crossId)) {
            map.addImage(crossId, createClusterCenterStyleImage(map, type), { pixelRatio: 2 });
          }
        });

        if (!map.hasImage('cluster-center-crosshair')) {
          map.addImage('cluster-center-crosshair', createClusterCenterStyleImage(map, 'OTHER'), { pixelRatio: 2 });
        }

        // ══════════════════════════════════════════════
        // REGISTER NEW SOS ATTENTION TEXTURES (WebGL)
        // ══════════════════════════════════════════════
        const ATTENTION_PRIORITIES = ['CRITICAL', 'ATTENTION', 'MONITORING'];
        DISASTER_TYPES.forEach((type) => {
          if (type === 'RESOLVED') return;
          ATTENTION_PRIORITIES.forEach((pri) => {
            const attnId = getSosAttentionImageId(type, pri);
            if (!map.hasImage(attnId)) {
              map.addImage(attnId, createSosAttentionStyleImage(map, type, pri), { pixelRatio: 2 });
            }
          });
        });

        // ══════════════════════════════════════════════
        // SOURCE 0: New SOS Live Attention Rings (4s duration)
        // ══════════════════════════════════════════════
        map.addSource('new-sos-attention-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });

        // Layer 0: New SOS Attention Rings (WebGL Symbol placed right under incident icon)
        map.addLayer({
          id: 'new-sos-attention-rings',
          type: 'symbol',
          source: 'new-sos-attention-source',
          layout: {
            'icon-image': ['get', 'attentionIcon'],
            'icon-size': 1.0,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          },
        });

        // ══════════════════════════════════════════════
        // SOURCE 1: Incident points (Phase 10: Show EVERY real individual location)
        // ══════════════════════════════════════════════
        map.addSource('incidents-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
          cluster: false, // Phase 10: Never collapse points into opaque cluster circles
        });

        // ══════════════════════════════════════════════
        // SOURCE 2: Cluster Geospatial Math Sources (Phase 10)
        // ══════════════════════════════════════════════
        map.addSource('cluster-areas-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });

        map.addSource('cluster-connections-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });

        map.addSource('cluster-distance-labels-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });

        map.addSource('cluster-centers-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });

        // SOURCE 2B: Cluster Leader Lines (Elevated label anchors)
        map.addSource('cluster-leader-lines-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });

        map.addSource('selected-incident-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });

        // Layer 1: Cluster area polygon fill (Physical geodesic radius - subtle secondary context)
        map.addLayer({
          id: 'cluster-area-fill',
          type: 'fill',
          source: 'cluster-areas-source',
          minzoom: 11.0,
          paint: {
            'fill-color': [
              'match', ['get', 'dominantHazard'],
              'FLOOD', DISASTER_CONFIGS.FLOOD.color,
              'FIRE', DISASTER_CONFIGS.FIRE.color,
              'CYCLONE_STORM', DISASTER_CONFIGS.CYCLONE_STORM.color,
              'CYCLONE', DISASTER_CONFIGS.CYCLONE.color,
              'EARTHQUAKE', DISASTER_CONFIGS.EARTHQUAKE.color,
              'BUILDING_COLLAPSE', DISASTER_CONFIGS.BUILDING_COLLAPSE.color,
              'LANDSLIDE', DISASTER_CONFIGS.LANDSLIDE.color,
              'MEDICAL', DISASTER_CONFIGS.MEDICAL.color,
              'TSUNAMI', DISASTER_CONFIGS.TSUNAMI.color,
              'AVALANCHE', DISASTER_CONFIGS.AVALANCHE.color,
              'LIGHTNING', DISASTER_CONFIGS.LIGHTNING.color,
              'THUNDERSTORM', DISASTER_CONFIGS.THUNDERSTORM.color,
              'DUSTSTORM', DISASTER_CONFIGS.DUSTSTORM.color,
              'SQUALL', DISASTER_CONFIGS.SQUALL.color,
              'HEATWAVE', DISASTER_CONFIGS.HEATWAVE.color,
              'COLDWAVE', DISASTER_CONFIGS.COLDWAVE.color,
              'DROUGHT', DISASTER_CONFIGS.DROUGHT.color,
              'FOREST_FIRE', DISASTER_CONFIGS.FOREST_FIRE.color,
              'URBAN_FLOOD', DISASTER_CONFIGS.URBAN_FLOOD.color,
              'CHEMICAL_EMERGENCY', DISASTER_CONFIGS.CHEMICAL_EMERGENCY.color,
              'BIOLOGICAL_EMERGENCY', DISASTER_CONFIGS.BIOLOGICAL_EMERGENCY.color,
              'NUCLEAR_RADIOLOGICAL_EMERGENCY', DISASTER_CONFIGS.NUCLEAR_RADIOLOGICAL_EMERGENCY.color,
              'AIR_POLLUTION_SMOG', DISASTER_CONFIGS.AIR_POLLUTION_SMOG.color,
              DISASTER_CONFIGS.OTHER.color,
            ],
            'fill-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0.02, 14, 0.04, 16, 0.06],
          },
        });

        // Layer 2: Cluster area polygon boundary stroke (Thin, subtle, secondary)
        map.addLayer({
          id: 'cluster-area-stroke',
          type: 'line',
          source: 'cluster-areas-source',
          minzoom: 11.0,
          paint: {
            'line-color': [
              'match', ['get', 'dominantHazard'],
              'FLOOD', DISASTER_CONFIGS.FLOOD.strokeColor,
              'FIRE', DISASTER_CONFIGS.FIRE.strokeColor,
              'CYCLONE_STORM', DISASTER_CONFIGS.CYCLONE_STORM.strokeColor,
              'CYCLONE', DISASTER_CONFIGS.CYCLONE.strokeColor,
              'EARTHQUAKE', DISASTER_CONFIGS.EARTHQUAKE.strokeColor,
              'BUILDING_COLLAPSE', DISASTER_CONFIGS.BUILDING_COLLAPSE.strokeColor,
              'LANDSLIDE', DISASTER_CONFIGS.LANDSLIDE.strokeColor,
              'MEDICAL', DISASTER_CONFIGS.MEDICAL.strokeColor,
              'TSUNAMI', DISASTER_CONFIGS.TSUNAMI.strokeColor,
              'AVALANCHE', DISASTER_CONFIGS.AVALANCHE.strokeColor,
              'LIGHTNING', DISASTER_CONFIGS.LIGHTNING.strokeColor,
              'THUNDERSTORM', DISASTER_CONFIGS.THUNDERSTORM.strokeColor,
              'DUSTSTORM', DISASTER_CONFIGS.DUSTSTORM.strokeColor,
              'SQUALL', DISASTER_CONFIGS.SQUALL.strokeColor,
              'HEATWAVE', DISASTER_CONFIGS.HEATWAVE.strokeColor,
              'COLDWAVE', DISASTER_CONFIGS.COLDWAVE.strokeColor,
              'DROUGHT', DISASTER_CONFIGS.DROUGHT.strokeColor,
              'FOREST_FIRE', DISASTER_CONFIGS.FOREST_FIRE.strokeColor,
              'URBAN_FLOOD', DISASTER_CONFIGS.URBAN_FLOOD.strokeColor,
              'CHEMICAL_EMERGENCY', DISASTER_CONFIGS.CHEMICAL_EMERGENCY.strokeColor,
              'BIOLOGICAL_EMERGENCY', DISASTER_CONFIGS.BIOLOGICAL_EMERGENCY.strokeColor,
              'NUCLEAR_RADIOLOGICAL_EMERGENCY', DISASTER_CONFIGS.NUCLEAR_RADIOLOGICAL_EMERGENCY.strokeColor,
              'AIR_POLLUTION_SMOG', DISASTER_CONFIGS.AIR_POLLUTION_SMOG.strokeColor,
              DISASTER_CONFIGS.OTHER.strokeColor,
            ],
            'line-width': 1.0,
            'line-dasharray': [3, 3],
            'line-opacity': 0.35,
          },
        });

        // Layer 2B: Cluster Leader Line (Connects cluster "+" center to elevated cluster label when zoomed in)
        map.addLayer({
          id: 'cluster-leader-line',
          type: 'line',
          source: 'cluster-leader-lines-source',
          minzoom: 14.0,
          paint: {
            'line-color': [
              'match', ['get', 'dominantHazard'],
              'FLOOD', '#0284c7',
              'FIRE', '#dc2626',
              'CYCLONE_STORM', '#475569',
              'CYCLONE', '#475569',
              'EARTHQUAKE', '#d97706',
              'BUILDING_COLLAPSE', '#92400e',
              'LANDSLIDE', '#713f12',
              'MEDICAL', '#be123c',
              'TSUNAMI', '#0e7490',
              'AVALANCHE', '#0369a1',
              'LIGHTNING', '#a16207',
              'THUNDERSTORM', '#4f46e5',
              'DUSTSTORM', '#b45309',
              'SQUALL', '#0891b2',
              'HEATWAVE', '#c2410c',
              'COLDWAVE', '#0369a1',
              'DROUGHT', '#a16207',
              'FOREST_FIRE', '#ea580c',
              'URBAN_FLOOD', '#1d4ed8',
              'CHEMICAL_EMERGENCY', '#65a30d',
              'BIOLOGICAL_EMERGENCY', '#9333ea',
              'NUCLEAR_RADIOLOGICAL_EMERGENCY', '#ca8a04',
              'AIR_POLLUTION_SMOG', '#57534e',
              '#ca8a04',
            ],
            'line-width': 1.2,
            'line-dasharray': [2, 2],
            'line-opacity': 0.70,
          },
        });

        // Layer 3: MST connection lines connecting same-disaster reports cleanly (No visual spaghetti)
        map.addLayer({
          id: 'cluster-connections-line',
          type: 'line',
          source: 'cluster-connections-source',
          minzoom: 13.0,
          paint: {
            'line-color': [
              'match', ['get', 'dominantHazard'],
              'FLOOD', '#38bdf8',
              'FIRE', '#f87171',
              'CYCLONE_STORM', '#94a3b8',
              'CYCLONE', '#94a3b8',
              'EARTHQUAKE', '#fbbf24',
              'BUILDING_COLLAPSE', '#d97706',
              'LANDSLIDE', '#fbbf24',
              'MEDICAL', '#f43f5e',
              'TSUNAMI', '#22d3ee',
              'AVALANCHE', '#7dd3fc',
              'LIGHTNING', '#fde047',
              'THUNDERSTORM', '#818cf8',
              'DUSTSTORM', '#f59e0b',
              'SQUALL', '#22d3ee',
              'HEATWAVE', '#fb923c',
              'COLDWAVE', '#a5f3fc',
              'DROUGHT', '#facc15',
              'FOREST_FIRE', '#fb923c',
              'URBAN_FLOOD', '#60a5fa',
              'CHEMICAL_EMERGENCY', '#a3e635',
              'BIOLOGICAL_EMERGENCY', '#c084fc',
              'NUCLEAR_RADIOLOGICAL_EMERGENCY', '#fde047',
              'AIR_POLLUTION_SMOG', '#a8a29e',
              '#94a3b8',
            ],
            'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.2, 12, 1.8, 16, 2.5],
            'line-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.45, 11, 0.75, 14, 0.90],
          },
        });

        // Layer 4: Distance labels on connection lines (Revealed from high zoom up)
        map.addLayer({
          id: 'cluster-distance-labels',
          type: 'symbol',
          source: 'cluster-distance-labels-source',
          minzoom: 14.0,
          layout: {
            'text-field': ['get', 'distanceLabel'],
            'text-size': 10.5,
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-allow-overlap': false,
            'text-ignore-placement': false,
            'text-optional': true,
            'symbol-sort-key': 6,
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': 'rgba(15, 23, 42, 0.95)',
            'text-halo-width': 2.5,
          },
        });

        // Layer 5: Cluster centroid "+" indicator with dashed leader line stem (Subtle, visually distinct)
        map.addLayer({
          id: 'cluster-centers-symbol',
          type: 'symbol',
          source: 'cluster-centers-source',
          minzoom: 14.0,
          layout: {
            'icon-image': ['get', 'centerIcon'],
            'icon-size': 1.0,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'symbol-sort-key': 4,
          },
        });

        // Layer 7: Selected incident highlight ring
        map.addLayer({
          id: 'selected-incident-ring',
          type: 'circle',
          source: 'selected-incident-source',
          paint: {
            'circle-radius': 16,
            'circle-color': 'rgba(56, 189, 248, 0.18)',
            'circle-stroke-width': 2.5,
            'circle-stroke-color': '#38bdf8',
            'circle-stroke-opacity': 0.95,
          },
        });

        // ══════════════════════════════════════════════
        // INDIVIDUAL INCIDENT LAYERS (All real points visible)
        // ══════════════════════════════════════════════

        // Layer 0: Critical Incident Structural Halo (Revealed for unclustered or zoomed-in)
        map.addLayer({
          id: 'critical-incident-halo',
          type: 'circle',
          source: 'incidents-source',
          filter: [
            'all',
            ['==', ['get', 'priorityLevel'], 'CRITICAL'],
            ['any', ['==', ['get', 'inCluster'], false], ['>=', ['zoom'], 14]],
          ],
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 8, 10, 11, 14, 14, 17, 17],
            'circle-color': 'rgba(239, 68, 68, 0.06)',
            'circle-stroke-width': 1.4,
            'circle-stroke-color': '#dc2626',
            'circle-stroke-opacity': 0.75,
          },
        });

        // Layer A: Disaster-Aware Animated Icons (WebGL-accelerated composite marker at EVERY real location)
        // At normal zoom (<14), member incidents inside multi-citizen clusters are represented by the cluster marker.
        // When zoomed in (>=14), all individual members appear cleanly at their exact coordinates.
        // Isolated incidents (inCluster: false) are ALWAYS visible at every zoom level.
        map.addLayer({
          id: 'unclustered-disaster-icon',
          type: 'symbol',
          source: 'incidents-source',
          filter: ['any', ['==', ['get', 'inCluster'], false], ['>=', ['zoom'], 14]],
          layout: {
            'icon-image': ['get', 'disasterIcon'],
            'icon-size': ['interpolate', ['linear'], ['zoom'], 4, 0.65, 8, 0.78, 12, 0.92, 15, 1.08, 17, 1.20],
            'icon-offset': ['get', 'iconOffset'],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          },
        });

        // Layer C1: Report Badge Indicator (e.g. "A", "B", "C" or compact count for coincident stacks)
        map.addLayer({
          id: 'unclustered-report-badge',
          type: 'symbol',
          source: 'incidents-source',
          minzoom: 14.0,
          filter: ['!=', ['get', 'reportBadge'], ''],
          layout: {
            'text-field': ['get', 'reportBadge'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 14, 9.5, 16, 11.0],
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-anchor': 'left',
            'text-offset': ['get', 'badgeOffset'],
            'text-allow-overlap': false,
            'text-ignore-placement': false,
            'text-optional': true,
            'symbol-sort-key': ['get', 'priorityScore'],
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': 'rgba(15, 23, 42, 0.95)',
            'text-halo-width': 2.5,
          },
        });

        // ══════════════════════════════════════════════
        // SOURCE 3: Analytical Fusion Clusters (Consolidated Markers at Normal Zoom)
        // ══════════════════════════════════════════════
        map.addSource('fusion-clusters-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });

        // Layer: Fusion cluster critical outer halo (Compact, proportional accent ring)
        map.addLayer({
          id: 'fusion-cluster-halo',
          type: 'circle',
          source: 'fusion-clusters-source',
          maxzoom: 14,
          filter: ['==', ['get', 'priority'], 'CRITICAL'],
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['get', 'reportCount'], 2, 16, 5, 18, 10, 20, 25, 22],
            'circle-color': 'rgba(239, 68, 68, 0.12)',
            'circle-stroke-width': 1.2,
            'circle-stroke-color': 'rgba(239, 68, 68, 0.5)',
          },
        });

        // Layer: Fusion cluster circular badge (Compact, proportional: radius 13 to 19px)
        map.addLayer({
          id: 'fusion-cluster-marker',
          type: 'circle',
          source: 'fusion-clusters-source',
          maxzoom: 14,
          paint: {
            'circle-radius': [
              'interpolate', ['linear'], ['get', 'reportCount'],
              2, 13,
              5, 15,
              10, 17,
              25, 19
            ],
            'circle-color': [
              'match', ['get', 'dominantHazard'],
              'FLOOD', '#0284c7',
              'FIRE', '#ef4444',
              'CYCLONE_STORM', '#64748b',
              'CYCLONE', '#64748b',
              'EARTHQUAKE', '#d97706',
              'BUILDING_COLLAPSE', '#b45309',
              'LANDSLIDE', '#854d0e',
              'MEDICAL', '#be123c',
              'TSUNAMI', '#0e7490',
              'AVALANCHE', '#0284c7',
              'LIGHTNING', '#ca8a04',
              'THUNDERSTORM', '#4f46e5',
              'DUSTSTORM', '#b45309',
              'SQUALL', '#0891b2',
              'HEATWAVE', '#ea580c',
              'COLDWAVE', '#0284c7',
              'DROUGHT', '#ca8a04',
              'FOREST_FIRE', '#ea580c',
              'URBAN_FLOOD', '#1d4ed8',
              'CHEMICAL_EMERGENCY', '#65a30d',
              'BIOLOGICAL_EMERGENCY', '#9333ea',
              'NUCLEAR_RADIOLOGICAL_EMERGENCY', '#ca8a04',
              'AIR_POLLUTION_SMOG', '#57534e',
              '#ef4444',
            ],
            'circle-stroke-width': 2.5,
            'circle-stroke-color': '#0f172a',
          },
        });

        // Layer: Fusion cluster report count in center of marker (NUMBER - primary hierarchy)
        map.addLayer({
          id: 'fusion-cluster-count',
          type: 'symbol',
          source: 'fusion-clusters-source',
          maxzoom: 14,
          layout: {
            'text-field': ['get', 'countStr'],
            'text-size': 11.5,
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-allow-overlap': true,
            'text-ignore-placement': true,
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': 'rgba(0, 0, 0, 0.85)',
            'text-halo-width': 1.5,
          },
        });

        // Layer: Fusion cluster category label directly below marker (CATEGORY - secondary hierarchy: MIXED or dominant type)
        // Hidden when colliding with nearby individual markers to prevent unreadable stacking
        map.addLayer({
          id: 'fusion-cluster-category-label',
          type: 'symbol',
          source: 'fusion-clusters-source',
          maxzoom: 14,
          layout: {
            'text-field': ['get', 'clusterShortLabel'],
            'text-size': 8.0,
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-offset': [0, 1.3],
            'text-anchor': 'top',
            'text-allow-overlap': false,
            'text-ignore-placement': false,
            'text-optional': true,
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': 'rgba(15, 23, 42, 0.95)',
            'text-halo-width': 2.0,
          },
        });

        // Layer: Elevated Fusion cluster label when zoomed in (High Zoom)
        map.addLayer({
          id: 'fusion-cluster-label',
          type: 'symbol',
          source: 'fusion-clusters-source',
          minzoom: 14.0,
          layout: {
            'text-field': ['concat', ['get', 'countStr'], ' • ', ['get', 'clusterShortLabel']],
            'text-size': 9.5,
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-allow-overlap': false,
            'text-ignore-placement': false,
            'text-anchor': 'bottom',
            'text-offset': [0, -2.0],
            'symbol-sort-key': ['get', 'priorityScore'],
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': 'rgba(15, 23, 42, 0.95)',
            'text-halo-width': 2.0,
          },
        });

        // ══════════════════════════════════════════════
        // EVENT HANDLERS (attached ONCE)
        // ══════════════════════════════════════════════

        // Click on individual incident point → open compact information panel
        const handleIncidentClick = (e) => {
          const features = map.queryRenderedFeatures(e.point, {
            layers: ['unclustered-disaster-icon', 'unclustered-report-badge'],
          });
          if (!features.length) return;
          const props = features[0].properties;
          const incidentIdx = props.incidentIndex;
          const incidentData = radarIncidentsRef.current[incidentIdx];
          if (incidentData) {
            setSelectedClusterData(null);
            selectIncidentTarget(incidentData);
          }
        };

        map.on('click', 'unclustered-disaster-icon', handleIncidentClick);
        map.on('click', 'unclustered-report-badge', handleIncidentClick);

        // Click on cluster area or marker → zoom into cluster and open compact cluster panel
        const handleClusterClick = (e) => {
          const features = map.queryRenderedFeatures(e.point, {
            layers: [
              'fusion-cluster-marker',
              'fusion-cluster-count',
              'fusion-cluster-category-label',
              'cluster-area-fill',
              'cluster-area-stroke',
              'cluster-centers-symbol',
              'fusion-cluster-label',
            ],
          });
          if (!features.length) return;
          const props = features[0].properties;
          const clusterIdx = props.clusterIndex;
          const clusterData =
            clusterGeometryDataRef.current?.enrichedClusters?.[clusterIdx] ||
            multiCitizenClustersRef.current[clusterIdx];

          if (clusterData) {
            setSelectedIncidentData(null);
            setSelectedClusterData(clusterData);
            handleFocusCluster(clusterData);
          }
        };

        map.on('click', 'fusion-cluster-marker', handleClusterClick);
        map.on('click', 'fusion-cluster-count', handleClusterClick);
        map.on('click', 'fusion-cluster-category-label', handleClusterClick);
        map.on('click', 'cluster-area-fill', handleClusterClick);
        map.on('click', 'cluster-area-stroke', handleClusterClick);
        map.on('click', 'cluster-centers-symbol', handleClusterClick);
        map.on('click', 'fusion-cluster-label', handleClusterClick);

        // Hover: show clean tactical report tooltip (e.g. EARTHQUAKE / INC-A16)
        map.on('mouseenter', 'unclustered-disaster-icon', (e) => {
          map.getCanvas().style.cursor = 'pointer';
          if (!e.features?.length || !popupRef.current) return;
          const feat = e.features[0];
          const props = feat.properties;
          const coords = feat.geometry.coordinates.slice();
          const cat = props.category || props.disasterType || 'INCIDENT';
          const sId = props.shortId || (props.incidentId ? String(props.incidentId).slice(-6).toUpperCase() : '');
          const pri = props.priority || 'HIGH';
          const status = props.status || 'ACTIVE';
          const pendingBadge = (props.aiPending === true || props.aiPending === 'true')
            ? '<div style="font-size: 8.5px; color: #f59e0b; margin-top: 2px; font-weight: 700;">⚡ AI PENDING</div>'
            : '';

          popupRef.current
            .setLngLat(coords)
            .setHTML(`
              <div style="font-family: monospace; font-size: 11px; padding: 5px 8px; background: rgba(20, 19, 18, 0.95); color: #ffffff; border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 8px; box-shadow: 0 4px 14px rgba(0,0,0,0.6); text-align: center; min-width: 110px;">
                <div style="font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px;">${cat}</div>
                <div style="font-size: 10px; color: #e2e8f0; font-weight: 700; margin-top: 1px;">${sId} • ${pri}</div>
                <div style="font-size: 9px; color: #94a3b8; margin-top: 2px;">STATUS: ${status}</div>
                ${pendingBadge}
              </div>
            `)
            .addTo(map);
        });

        map.on('mouseleave', 'unclustered-disaster-icon', () => {
          map.getCanvas().style.cursor = '';
          if (popupRef.current) {
            popupRef.current.remove();
          }
        });

        // Hover on cluster marker → show clean cluster overview
        map.on('mouseenter', 'fusion-cluster-marker', (e) => {
          map.getCanvas().style.cursor = 'pointer';
          if (!e.features?.length || !popupRef.current) return;
          const feat = e.features[0];
          const props = feat.properties;
          const coords = feat.geometry.coordinates.slice();
          const dom = props.dominantHazard || 'INCIDENT';
          const cnt = props.reportCount || 1;
          const isMixed = props.isMixed === true || props.isMixed === 'true';
          const pri = props.priority || 'HIGH';
          const title = isMixed ? 'MIXED CLUSTER' : `${dom} CLUSTER`;
          const critText = props.criticalCount > 0 ? ` • <span style="color:#ef4444;">${props.criticalCount} CRITICAL</span>` : '';

          popupRef.current
            .setLngLat(coords)
            .setHTML(`
              <div style="font-family: monospace; font-size: 11px; padding: 6px 10px; background: rgba(20, 19, 18, 0.95); color: #ffffff; border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 8px; box-shadow: 0 4px 14px rgba(0,0,0,0.6); text-align: center; min-width: 120px;">
                <div style="font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px;">${title}</div>
                <div style="font-size: 10.5px; color: #ffffff; font-weight: 700; margin-top: 2px;">${cnt} REPORTS • ${pri}${critText}</div>
                <div style="font-size: 8.5px; color: #94a3b8; margin-top: 3px;">Click to zoom & inspect</div>
              </div>
            `)
            .addTo(map);
        });

        map.on('mouseleave', 'fusion-cluster-marker', () => {
          map.getCanvas().style.cursor = '';
          if (popupRef.current) {
            popupRef.current.remove();
          }
        });

        // Cursor: pointer on hoverable layers
        const interactiveLayers = [
          'unclustered-disaster-icon',
          'unclustered-report-badge',
          'fusion-cluster-marker',
          'fusion-cluster-count',
          'cluster-area-fill',
          'cluster-centers-symbol',
          'fusion-cluster-label',
        ];
        interactiveLayers.forEach((layerId) => {
          map.on('mouseenter', layerId, () => {
            map.getCanvas().style.cursor = 'pointer';
          });
          map.on('mouseleave', layerId, () => {
            map.getCanvas().style.cursor = '';
          });
        });

        // Hydrate initial GeoJSON sources immediately upon map load
        try {
          if (incidentsGeoJSONRef.current && map.getSource('incidents-source')) {
            map.getSource('incidents-source').setData(incidentsGeoJSONRef.current);
          }
          if (fusionClustersGeoJSONRef.current && map.getSource('fusion-clusters-source')) {
            map.getSource('fusion-clusters-source').setData(fusionClustersGeoJSONRef.current);
          }
          if (clusterGeometryDataRef.current) {
            if (map.getSource('cluster-areas-source')) map.getSource('cluster-areas-source').setData(clusterGeometryDataRef.current.areasGeoJSON);
            if (map.getSource('cluster-connections-source')) map.getSource('cluster-connections-source').setData(clusterGeometryDataRef.current.connectionsGeoJSON);
            if (map.getSource('cluster-distance-labels-source')) map.getSource('cluster-distance-labels-source').setData(clusterGeometryDataRef.current.distanceLabelsGeoJSON);
            if (map.getSource('cluster-centers-source')) map.getSource('cluster-centers-source').setData(clusterGeometryDataRef.current.clusterCentersGeoJSON);
            if (map.getSource('cluster-leader-lines-source')) map.getSource('cluster-leader-lines-source').setData(clusterGeometryDataRef.current.leaderLinesGeoJSON);
          }
          if (selectedIncidentGeoJSONRef.current && map.getSource('selected-incident-source')) {
            map.getSource('selected-incident-source').setData(selectedIncidentGeoJSONRef.current);
          }
        } catch (e) {
          console.warn('[LiveIncidentRadar] Initial data load warning:', e.message);
        }

        // If focusTarget was specified prior to map load, apply focus immediately.
        // When hasPendingFocus is true, the map already started at these coordinates —
        // skip flyTo to avoid a redundant 1200ms animation from the same point.
        const fLat = focusTargetRef.current?.lat ?? focusTargetRef.current?.latitude;
        const fLng = focusTargetRef.current?.lng ?? focusTargetRef.current?.longitude;
        if (fLng != null && fLat != null && !isNaN(Number(fLat)) && !isNaN(Number(fLng))) {
          hasInitialFitRef.current = true;
          if (!hasPendingFocus) {
            // Map started at a different center — fly to the target
            map.flyTo({
              center: [Number(fLng), Number(fLat)],
              zoom: focusTargetRef.current.zoom || 16,
              duration: 1200,
            });
          }
          // Always select the incident to show its panel
          selectIncidentTarget({ ...focusTargetRef.current, lat: Number(fLat), lng: Number(fLng) });
        }
      });

      map.on('error', (e) => {
        console.warn('[LiveIncidentRadar] MapLibre error:', e.error?.message || e.message);
      });

      mapInstanceRef.current = map;

      // ResizeObserver: recalculate map canvas on genuine container resize only
      let resizeTimer = null;
      let lastObservedWidth = 0;
      let lastObservedHeight = 0;
      const ro = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry) {
          const { width, height } = entry.contentRect;
          if (Math.abs(width - lastObservedWidth) < 1 && Math.abs(height - lastObservedHeight) < 1) {
            return;
          }
          lastObservedWidth = width;
          lastObservedHeight = height;
        }
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.resize();
          }
        }, 150);
      });
      ro.observe(mapContainerRef.current);
      resizeObserverRef.current = ro;

      return () => {
        ro.disconnect();
        clearTimeout(resizeTimer);

        // Remove registered disaster & attention textures on cleanup
        if (mapInstanceRef.current) {
          const ATTENTION_PRIORITIES = ['CRITICAL', 'ATTENTION', 'MONITORING'];
          DISASTER_TYPES.forEach((type) => {
            const iconId = `disaster-${type.toLowerCase()}`;
            if (mapInstanceRef.current?.hasImage(iconId)) {
              try {
                mapInstanceRef.current.removeImage(iconId);
              } catch (e) {}
            }
            const critIconId = `disaster-${type.toLowerCase()}-critical`;
            if (mapInstanceRef.current?.hasImage(critIconId)) {
              try {
                mapInstanceRef.current.removeImage(critIconId);
              } catch (e) {}
            }
            const crossId = `cluster-center-${type.toLowerCase()}`;
            if (mapInstanceRef.current?.hasImage(crossId)) {
              try {
                mapInstanceRef.current.removeImage(crossId);
              } catch (e) {}
            }
            ATTENTION_PRIORITIES.forEach((pri) => {
              const attnId = getSosAttentionImageId(type, pri);
              if (mapInstanceRef.current?.hasImage(attnId)) {
                try {
                  mapInstanceRef.current.removeImage(attnId);
                } catch (e) {}
              }
            });
          });

          if (mapInstanceRef.current?.hasImage('cluster-center-crosshair')) {
            try {
              mapInstanceRef.current.removeImage('cluster-center-crosshair');
            } catch (e) {}
          }
        }

        // Clear active attention timers
        activeAttentionFeaturesRef.current.forEach((val) => clearTimeout(val.timeoutId));
        activeAttentionFeaturesRef.current.clear();
        if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);

        if (popupRef.current) {
          popupRef.current.remove();
          popupRef.current = null;
        }
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
          mapLoadedRef.current = false;
        }
      };
    } catch (err) {
      console.error('[LiveIncidentRadar] Map initialization error:', err);
      setMapError('Failed to initialize map. The dashboard remains functional.');
    }
  }, []);

  // Helper to push currently active attention features into MapLibre source
  const updateAttentionSource = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapLoadedRef.current) return;
    try {
      const src = map.getSource('new-sos-attention-source');
      if (src) {
        const features = Array.from(activeAttentionFeaturesRef.current.values()).map((v) => v.feature);
        src.setData({
          type: 'FeatureCollection',
          features,
        });
      }
    } catch (e) {
      console.warn('[LiveIncidentRadar] Error updating attention source:', e.message);
    }
  }, []);

  // Smart auto-fit bounds helper that frames real active incidents with sensible padding and zoom bounds
  const fitMapToIncidents = useCallback((incidentsList, animate = true) => {
    const map = mapInstanceRef.current;
    if (!map || !incidentsList || incidentsList.length === 0) return;

    const validCoords = incidentsList
      .filter((i) => typeof i.lng === 'number' && typeof i.lat === 'number' && !isNaN(i.lng) && !isNaN(i.lat) && i.lng !== 0 && i.lat !== 0)
      .map((i) => [i.lng, i.lat]);

    if (validCoords.length === 0) return;

    if (validCoords.length === 1) {
      map.flyTo({ center: validCoords[0], zoom: 14.5, duration: animate ? 1000 : 0 });
      return;
    }

    const lngs = validCoords.map((c) => c[0]);
    const lats = validCoords.map((c) => c[1]);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const dLng = maxLng - minLng;
    const dLat = maxLat - minLat;

    // If all incidents are clustered within a small neighborhood (< 1km)
    if (dLng < 0.015 && dLat < 0.015) {
      map.flyTo({
        center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2],
        zoom: 14,
        duration: animate ? 1000 : 0,
      });
    } else {
      const bounds = new maplibregl.LngLatBounds([minLng, minLat], [maxLng, maxLat]);
      map.fitBounds(bounds, {
        padding: { top: 60, bottom: 60, left: 60, right: 60 },
        minZoom: 6.5,
        maxZoom: 15,
        duration: animate ? 1000 : 0,
      });
    }
  }, []);

  // Update GeoJSON sources when incident/cluster data changes
  // Single setData() call instead of DOM manipulation
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapLoadedRef.current) return;

    // 1. Update incidents source FIRST (incident appears immediately)
    try {
      const incidentsSource = map.getSource('incidents-source');
      if (incidentsSource) {
        incidentsSource.setData(incidentsGeoJSON);
      }
    } catch (err) {
      console.warn('[LiveIncidentRadar] Error updating incidents source:', err.message);
    }

    // 2. Initial load auto-fit ONLY ONCE & seed seenIncidentIdsRef
    if (!hasInitialFitRef.current && radarIncidents.length > 0) {
      if (focusTargetRef.current?.lng != null && focusTargetRef.current?.lat != null) {
        hasInitialFitRef.current = true;
        map.flyTo({
          center: [focusTargetRef.current.lng, focusTargetRef.current.lat],
          zoom: focusTargetRef.current.zoom || 16,
          duration: 1200,
        });
        selectIncidentTarget(focusTargetRef.current);
      } else {
        fitMapToIncidents(radarIncidents, true);
        hasInitialFitRef.current = true;
      }
    } else if (focusTargetRef.current && (!selectedIncidentData || !selectedIncidentData.metrics)) {
      selectIncidentTarget(focusTargetRef.current);
    }

    // 3. Initial load seeding: historical incidents loaded on mount NEVER trigger attention effect
    if (!hasInitializedSeenRef.current) {
      if (radarIncidents.length > 0) {
        radarIncidents.forEach((i) => seenIncidentIdsRef.current.add(i.incidentId));
        hasInitializedSeenRef.current = true;
      }
      return;
    }

    // 4. Genuine New SOS Detection & Attention Effect
    const genuinelyNewIncidents = radarIncidents.filter(
      (i) => !seenIncidentIdsRef.current.has(i.incidentId) && i.priorityInfo?.level !== 'RESOLVED'
    );

    if (genuinelyNewIncidents.length > 0) {
      let updatedAttention = false;

      genuinelyNewIncidents.forEach((newInc) => {
        // Mark as seen immediately (duplicate & reconnect prevention)
        seenIncidentIdsRef.current.add(newInc.incidentId);

        const priorityLevel = newInc.priorityInfo?.level || 'ATTENTION';
        const attentionIcon = getSosAttentionImageId(newInc.disasterType, priorityLevel);

        const feature = {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [newInc.lng, newInc.lat],
          },
          properties: {
            incidentId: newInc.incidentId,
            disasterType: newInc.disasterType,
            priorityLevel: priorityLevel,
            attentionIcon: attentionIcon,
          },
        };

        // Clear any existing timer for this ID
        if (activeAttentionFeaturesRef.current.has(newInc.incidentId)) {
          clearTimeout(activeAttentionFeaturesRef.current.get(newInc.incidentId).timeoutId);
        }

        // Short duration attention animation (~1.8s, 1–2s specification)
        // Then cleanly settles into normal category-specific visualization
        const timeoutId = setTimeout(() => {
          activeAttentionFeaturesRef.current.delete(newInc.incidentId);
          updateAttentionSource();
        }, 1800);

        activeAttentionFeaturesRef.current.set(newInc.incidentId, { feature, timeoutId });
        updatedAttention = true;
      });

      if (updatedAttention) {
        updateAttentionSource();

        // Subtle tactical notification toast (2.5s duration)
        const primary = genuinelyNewIncidents[0];
        setNewIncidentNotification({
          count: genuinelyNewIncidents.length,
          id: primary.incidentId,
          category: primary.category,
          priority: primary.priority,
          location: primary.locationStr,
        });

        if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);
        notificationTimerRef.current = setTimeout(() => {
          setNewIncidentNotification(null);
        }, 2500);
      }
    }
  }, [incidentsGeoJSON, radarIncidents, updateAttentionSource]);

  // Update fusion clusters source separately
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapLoadedRef.current) return;

    try {
      const fusionSource = map.getSource('fusion-clusters-source');
      if (fusionSource) {
        fusionSource.setData(fusionClustersGeoJSON);
      }
    } catch (err) {
      console.warn('[LiveIncidentRadar] Error updating fusion source:', err.message);
    }
  }, [fusionClustersGeoJSON]);

  // Phase 10: Update cluster geometry, leader lines & connection sources
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapLoadedRef.current) return;

    try {
      const areasSrc = map.getSource('cluster-areas-source');
      if (areasSrc) areasSrc.setData(clusterGeometryData.areasGeoJSON);

      const connSrc = map.getSource('cluster-connections-source');
      if (connSrc) connSrc.setData(clusterGeometryData.connectionsGeoJSON);

      const distSrc = map.getSource('cluster-distance-labels-source');
      if (distSrc) distSrc.setData(clusterGeometryData.distanceLabelsGeoJSON);

      const centersSrc = map.getSource('cluster-centers-source');
      if (centersSrc) centersSrc.setData(clusterGeometryData.clusterCentersGeoJSON);

      const leaderSrc = map.getSource('cluster-leader-lines-source');
      if (leaderSrc) leaderSrc.setData(clusterGeometryData.leaderLinesGeoJSON);
    } catch (err) {
      console.warn('[LiveIncidentRadar] Error updating cluster geometry sources:', err.message);
    }
  }, [clusterGeometryData]);

  // Phase 10: Update selected incident highlight source
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapLoadedRef.current) return;

    try {
      const selSrc = map.getSource('selected-incident-source');
      if (selSrc) selSrc.setData(selectedIncidentGeoJSON);
    } catch (err) {
      console.warn('[LiveIncidentRadar] Error updating selected incident source:', err.message);
    }
  }, [selectedIncidentGeoJSON]);

  // Active incidents count for operational controls badge (radarIncidents is active-only)
  const activeIncidentsCount = radarIncidents.length;

  // Clear selected incident HUD if it is no longer active
  useEffect(() => {
    if (selectedIncidentData) {
      const stillActive = radarIncidents.some((i) => i.incidentId === selectedIncidentData.incidentId);
      if (!stillActive) {
        setSelectedIncidentData(null);
        if (popupRef.current) popupRef.current.remove();
      }
    }
  }, [radarIncidents, selectedIncidentData]);

  // Update or clear selected cluster HUD if cluster membership changed
  useEffect(() => {
    if (selectedClusterData) {
      const activeCluster = clusterGeometryData.enrichedClusters.find(
        (c) => c.clusterId === selectedClusterData.clusterId
      );
      if (!activeCluster) {
        // Cluster no longer exists (fewer than 2 active reports)
        setSelectedClusterData(null);
        if (popupRef.current) popupRef.current.remove();
      } else if (activeCluster.reportCount !== selectedClusterData.reportCount) {
        // Cluster reports count changed (e.g. 5 -> 4)
        setSelectedClusterData(activeCluster);
      }
    }
  }, [clusterGeometryData.enrichedClusters, selectedClusterData]);

  // Cleanup animation / attention state for any incident that is no longer active
  useEffect(() => {
    const activeIds = new Set(radarIncidents.map((i) => i.incidentId));
    let attentionRemoved = false;
    for (const [id, attentionObj] of activeAttentionFeaturesRef.current.entries()) {
      if (!activeIds.has(id)) {
        if (attentionObj.timeoutId) clearTimeout(attentionObj.timeoutId);
        activeAttentionFeaturesRef.current.delete(id);
        attentionRemoved = true;
      }
    }
    if (attentionRemoved) {
      updateAttentionSource();
    }
  }, [radarIncidents, updateAttentionSource]);

  // Phase 7 & Manage Incident GPS: Handle Focus Area camera flyTo and incident selection (Zero map reload)
  useEffect(() => {
    focusTargetRef.current = focusTarget;
    if (focusTarget && mapInstanceRef.current && mapLoadedRef.current) {
      const fLat = focusTarget.lat ?? focusTarget.latitude;
      const fLng = focusTarget.lng ?? focusTarget.longitude;
      if (fLng != null && fLat != null && !isNaN(Number(fLat)) && !isNaN(Number(fLng))) {
        hasInitialFitRef.current = true;
        mapInstanceRef.current.flyTo({
          center: [Number(fLng), Number(fLat)],
          zoom: focusTarget.zoom || 16,
          duration: 1200,
        });
      }
      if (focusTarget.incidentId || (fLat != null && fLng != null && !focusTarget.clusterId)) {
        selectIncidentTarget({ ...focusTarget, lat: fLat != null ? Number(fLat) : undefined, lng: fLng != null ? Number(fLng) : undefined });
      }
    }
  }, [focusTarget, selectIncidentTarget]);

  // Notification banner on NEW Critical Incidents
  useEffect(() => {
    const criticalInc = radarIncidents.find((i) => i.priorityInfo.level === 'CRITICAL');
    if (criticalInc && !notifiedCriticalIdsRef.current.has(criticalInc.radarId)) {
      notifiedCriticalIdsRef.current.add(criticalInc.radarId);
      setNewIncidentNotification(`🚨 New Critical Incident: ${criticalInc.category} in ${criticalInc.locationStr}`);
      if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);
      notificationTimerRef.current = setTimeout(() => setNewIncidentNotification(null), 5000);
    }
    return () => {
      if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);
    };
  }, [radarIncidents]);

  const handleRibbonItemClick = (inc) => {
    setFocusedIncidentId(inc.radarId);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo({ center: [inc.lng, inc.lat], zoom: 15, duration: 1200 });
    }
    onSelectIncident?.(inc);
  };

  const handleZoomIn = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomIn({ duration: 200 });
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomOut({ duration: 200 });
  };

  const handleResetCenter = () => {
    if (mapInstanceRef.current) {
      if (radarIncidents.length > 0) {
        fitMapToIncidents(radarIncidents, true);
      } else {
        mapInstanceRef.current.flyTo({ center: [78.9629, 20.5937], zoom: 4, duration: 1000 });
      }
    }
  };

  const handleFitAllIncidents = () => {
    fitMapToIncidents(radarIncidents, true);
  };

  const handleFocusActive = () => {
    if (!mapInstanceRef.current || radarIncidents.length === 0) return;

    // Filter active incidents with valid numeric coordinates (radarIncidents is already strictly active)
    const validActive = radarIncidents.filter(
      (inc) => typeof inc.lng === 'number' && typeof inc.lat === 'number' && !isNaN(inc.lng) && !isNaN(inc.lat)
    );

    if (validActive.length === 0) return;

    // Prioritize high-priority / critical active incidents if present
    const highOrCritical = validActive.filter((inc) => {
      const pLevel = (inc.priorityInfo?.level || '').toUpperCase();
      const p = (inc.priority || '').toUpperCase();
      return pLevel === 'CRITICAL' || pLevel === 'HIGH' || pLevel === 'WARNING' || p === 'CRITICAL' || p === 'HIGH';
    });

    const targetIncidents = highOrCritical.length > 0 ? highOrCritical : validActive;
    fitMapToIncidents(targetIncidents, true);
  };

  // Phase 10: Smoothly fit/focus map on cluster extent using actual member incident coordinates
  const handleFocusCluster = useCallback((cluster) => {
    if (!mapInstanceRef.current || !cluster) return;
    const members = cluster.memberIncidents || [];
    if (members.length === 1) {
      mapInstanceRef.current.flyTo({
        center: [members[0].lng, members[0].lat],
        zoom: 16,
        duration: 800,
      });
    } else if (members.length > 1) {
      const coords = members.map((m) => [m.lng, m.lat]);
      const bounds = coords.reduce(
        (b, c) => b.extend(c),
        new maplibregl.LngLatBounds(coords[0], coords[0])
      );
      mapInstanceRef.current.fitBounds(bounds, {
        padding: 60,
        maxZoom: 16,
        duration: 800,
      });
    } else if (cluster.centroid?.lat && cluster.centroid?.lng) {
      mapInstanceRef.current.flyTo({
        center: [cluster.centroid.lng, cluster.centroid.lat],
        zoom: 15,
        duration: 800,
      });
    }
  }, []);

  return (
    <Card className="p-0 border border-outline-variant/60 shadow-xl overflow-hidden relative bg-surface-container-lowest">
      {/* ==================================================================== */}
      {/* 1. TACTICAL REAL-TIME RIBBON (Responsive single-line horizontal scroll) */}
      {/* ==================================================================== */}
      <div className="px-3.5 py-2 bg-[#141312] border-b border-outline-variant/60 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 text-xs select-none z-20 relative">
        <div className="flex items-center gap-2 shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-error animate-ping" />
          <span className="font-mono font-black text-primary uppercase text-[11px] tracking-wider flex items-center gap-1 shrink-0">
            <span className="material-symbols-outlined text-sm text-secondary">map</span>
            <span>LIVE INCIDENT MAP</span>
          </span>
          <span className="text-[10px] font-mono text-on-surface-variant font-bold bg-surface-container px-2 py-0.5 rounded border border-outline-variant/60 shrink-0">
            {activeIncidentsCount} ACTIVE • {clusterGeometryData.enrichedClusters.length} CLUSTERS
          </span>
        </div>

        <div className="min-w-0 flex-1 flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5 justify-start sm:justify-end whitespace-nowrap">
          {/* Active Incident Cluster Pills with Real-Time Recalculated Report Counts */}
          {clusterGeometryData.enrichedClusters.map((cluster) => {
            const norm = normalizeDisasterCategory(cluster.dominantHazard || 'GENERAL');
            const cfg = DISASTER_CONFIGS[norm] || DISASTER_CONFIGS.OTHER;
            const p = (cluster.priority || 'HIGH').toUpperCase();
            const badgeColor = p === 'CRITICAL' ? 'bg-red-700 text-white' : 'bg-amber-600 text-white';

            return (
              <button
                key={cluster.clusterId}
                type="button"
                onClick={() => {
                  handleFocusCluster(cluster);
                  setSelectedClusterData(cluster);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1c1b1a] text-white border border-outline-variant/60 hover:border-secondary transition-all cursor-pointer shrink-0 text-[11px] font-bold shadow-xs active:scale-95"
                title={`Focus ${cfg.label} Cluster`}
              >
                <span>{cfg.emoji}</span>
                <span className="uppercase font-extrabold max-w-[90px] truncate">{cfg.label}</span>
                <span className="text-on-surface-variant font-mono">•</span>
                <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded ${badgeColor}`}>{cluster.reportCount}</span>
              </button>
            );
          })}

          {recentRibbonIncidents.length === 0 && clusterGeometryData.enrichedClusters.length === 0 ? (
            <span className="text-on-surface-variant text-[11px] italic font-mono">No active incidents.</span>
          ) : (
            recentRibbonIncidents.map((inc) => (
              <button
                key={inc.radarId}
                type="button"
                onClick={() => handleRibbonItemClick(inc)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface border border-outline-variant/60 hover:border-secondary transition-all cursor-pointer shrink-0 text-[11px] font-bold shadow-xs active:scale-95"
                title={`${inc.category} (${inc.timeAgo})`}
              >
                <span>{inc.priorityInfo.iconEmoji}</span>
                <span className="text-primary uppercase font-extrabold max-w-[90px] truncate">{inc.category}</span>
                <span className="text-[10px] font-mono text-on-surface-variant">• {inc.timeAgo}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Auto Focus Critical Incident Notification Banner */}
      {newIncidentNotification && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 pointer-events-none transition-all duration-300">
          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#181716]/95 border border-error/70 shadow-2xl shadow-error/20 backdrop-blur-sm text-xs font-mono text-white">
            <span className="w-2.5 h-2.5 rounded-full bg-error animate-ping" />
            <span className="font-black text-error">NEW SOS</span>
            <span className="text-on-surface-variant">•</span>
            <span className="font-bold">
              {typeof newIncidentNotification === 'string'
                ? newIncidentNotification
                : newIncidentNotification.category}
            </span>
            {newIncidentNotification?.priority && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-error/30 text-error font-extrabold uppercase">
                {newIncidentNotification.priority}
              </span>
            )}
            {newIncidentNotification?.count > 1 && (
              <span className="text-[10px] text-amber-400 font-bold">
                (+{newIncidentNotification.count - 1} more)
              </span>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. MAPLIBRE GL WEBGL MAP CANVAS (Balanced Operational Height) */}
      {/* ==================================================================== */}
      <div className="relative w-full h-[360px] sm:h-[400px] lg:h-[440px] xl:h-[460px] bg-[#141312] z-10">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Compact Incident Information Panel */}
        {selectedIncidentData && (
          <div className="absolute top-3 right-3 z-30 w-72 max-w-[calc(100%-24px)] bg-[#181716]/95 border border-outline-variant/80 rounded-2xl p-4 shadow-2xl backdrop-blur-md text-xs font-sans text-white animate-fade-in space-y-3 pointer-events-auto">
            {/* Header: TYPE, Severity, Reports count, Close */}
            <div className="flex items-start justify-between gap-2 border-b border-outline-variant/60 pb-2.5">
              <div className="space-y-1">
                <div className="font-black text-primary uppercase text-sm tracking-wide">
                  {selectedIncidentData.category || 'EMERGENCY'}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-black uppercase tracking-wider ${
                    selectedIncidentData.priorityInfo?.level === 'CRITICAL' || String(selectedIncidentData.priority).toUpperCase().includes('CRIT')
                      ? 'bg-error text-white'
                      : selectedIncidentData.priorityInfo?.level === 'ATTENTION' || String(selectedIncidentData.priority).toUpperCase().includes('HIGH')
                      ? 'bg-amber-600 text-white'
                      : 'bg-sky-600 text-white'
                  }`}>
                    {selectedIncidentData.priority || 'HIGH'}
                  </span>
                  <span className="text-xs text-on-surface-variant font-mono">
                    {selectedIncidentData.coincidentIncidents?.length > 1
                      ? `${selectedIncidentData.coincidentIncidents.length} reports`
                      : (selectedIncidentData.reportCount ? `${selectedIncidentData.reportCount} reports` : '1 report')}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedIncidentData(null)}
                className="w-6 h-6 rounded-full bg-surface-container hover:bg-surface-container-high border border-outline-variant/60 flex items-center justify-center text-on-surface-variant hover:text-white cursor-pointer transition-colors text-xs shrink-0"
                title="Close Incident Panel"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Location & Time */}
            <div className="space-y-1 text-xs">
              <div className="flex items-start gap-1.5 text-primary font-medium">
                <span className="material-symbols-outlined text-sm text-secondary shrink-0 mt-0.5">location_on</span>
                <span className="truncate">{cleanLocationName(selectedIncidentData.locationStr)}</span>
              </div>
              <div className="text-[11px] text-on-surface-variant font-mono pl-5">
                Updated {selectedIncidentData.timeAgo || 'recently'}
              </div>
            </div>

            {/* Action: [View Incident] */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  onSelectIncidentRef.current?.(selectedIncidentData);
                }}
                className="w-full py-2 px-3 rounded-xl bg-primary text-white hover:brightness-110 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-sm active:scale-98"
              >
                <span className="material-symbols-outlined text-sm">visibility</span>
                <span>View Incident</span>
              </button>
            </div>
          </div>
        )}

        {/* Compact Cluster Information Panel */}
        {selectedClusterData && (
          <div className="absolute top-3 left-3 z-30 w-76 max-w-[calc(100%-24px)] bg-[#181716]/95 border border-outline-variant/80 rounded-2xl p-4 shadow-2xl backdrop-blur-md text-xs font-sans text-white animate-fade-in space-y-3 pointer-events-auto">
            {/* Header: "[HAZARD] CLUSTER", Close */}
            <div className="flex items-start justify-between gap-2 border-b border-outline-variant/60 pb-2.5">
              <div className="space-y-1">
                <h3 className="font-black text-primary uppercase text-sm tracking-wide">
                  {selectedClusterData.groupName || `${selectedClusterData.dominantHazard || 'INCIDENT'} CLUSTER`}
                </h3>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-black uppercase tracking-wider ${
                    (selectedClusterData.highestPriority || selectedClusterData.priority || '').toUpperCase().includes('CRIT')
                      ? 'bg-error text-white'
                      : 'bg-amber-600 text-white'
                  }`}>
                    {(selectedClusterData.highestPriority || selectedClusterData.priority || 'HIGH').toUpperCase()}
                  </span>
                  <span className="text-xs text-on-surface-variant font-mono">
                    {selectedClusterData.reportCount || selectedClusterData.memberIncidents?.length || 2} reports
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedClusterData(null)}
                className="w-6 h-6 rounded-full bg-surface-container hover:bg-surface-container-high border border-outline-variant/60 flex items-center justify-center text-on-surface-variant hover:text-white cursor-pointer transition-colors text-xs shrink-0"
                title="Close Cluster Panel"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Locations count & Area description */}
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-1.5 text-primary font-medium">
                <span className="material-symbols-outlined text-sm text-secondary shrink-0">pin_drop</span>
                <span>
                  {(() => {
                    const uniqueLocs = new Set(
                      (selectedClusterData.memberIncidents || []).map(
                        (m) => `${Number(m.lat || 0).toFixed(3)},${Number(m.lng || 0).toFixed(3)}`
                      )
                    ).size;
                    return `${Math.max(1, uniqueLocs || selectedClusterData.locationCount || 3)} locations`;
                  })()}
                </span>
              </div>
              <div className="text-[11px] text-on-surface-variant font-mono pl-5">
                {cleanLocationName(selectedClusterData.geographicArea?.description || selectedClusterData.locationStr || 'Salem Operational Zone')}
              </div>
            </div>

            {/* Action: [Inspect Cluster] */}
            <div className="pt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onSelectCluster?.(selectedClusterData);
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-secondary text-on-secondary hover:brightness-110 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-sm active:scale-98"
              >
                <span className="material-symbols-outlined text-sm">hub</span>
                <span>Inspect Cluster</span>
              </button>
              <button
                type="button"
                onClick={() => handleFocusCluster(selectedClusterData)}
                className="py-2 px-3 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/60 text-primary font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-all"
                title="Center and Zoom to Cluster"
              >
                <span className="material-symbols-outlined text-sm">filter_center_focus</span>
              </button>
            </div>
          </div>
        )}

        {/* Map Error Fallback State */}
        {mapError && (
          <div className="absolute inset-0 bg-[#11100f]/75 backdrop-blur-xs z-30 flex items-center justify-center pointer-events-none p-4">
            <div className="bg-[#181716]/95 border border-error/60 rounded-2xl px-6 py-4 text-center shadow-2xl space-y-1">
              <span className="material-symbols-outlined text-3xl text-error">error</span>
              <h4 className="text-sm font-extrabold text-error uppercase tracking-wider">Map Unavailable</h4>
              <p className="text-xs text-on-surface-variant">{mapError}</p>
            </div>
          </div>
        )}

        {/* Empty Map Overlay State (When 0 real incidents exist) */}
        {radarIncidents.length === 0 && !mapError && (
          <div className="absolute inset-0 bg-[#11100f]/75 backdrop-blur-xs z-30 flex items-center justify-center pointer-events-none p-4">
            <div className="bg-[#181716]/95 border border-outline-variant/80 rounded-2xl px-6 py-4 text-center shadow-2xl space-y-1">
              <span className="material-symbols-outlined text-3xl text-on-surface-variant">map</span>
              <h4 className="text-sm font-extrabold text-primary uppercase tracking-wider">No active incidents reported.</h4>
              <p className="text-xs text-on-surface-variant">No active incidents.</p>
            </div>
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* 3. ACCESSIBLE SEVERITY LEGEND & MAP CONTROLS                         */}
      {/* ==================================================================== */}
      <div className="p-3 bg-surface-container border-t border-outline-variant/60 flex flex-wrap items-center justify-between gap-3 text-xs z-20 relative">
        {/* Accessible Severity Legend: CRITICAL, HIGH, MONITORING, RESOLVED */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 text-xs">
          <span className="text-[10px] font-mono font-bold uppercase text-on-surface-variant tracking-wider">
            LEGEND:
          </span>
          <div className="flex flex-wrap items-center gap-2 font-mono font-extrabold text-[11px]">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-error/20 border border-error/50 text-error font-bold" title="Critical incident">
              <span className="w-2.5 h-2.5 rounded-full bg-error inline-block animate-pulse" />
              <span>CRITICAL</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/20 border border-amber-500/50 text-amber-400 font-bold" title="High priority incident">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
              <span>HIGH</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sky-500/20 border border-sky-500/50 text-sky-400 font-bold" title="Monitoring incident">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" />
              <span>MONITORING</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 font-bold" title="Resolved incident">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              <span>RESOLVED</span>
            </span>
          </div>
        </div>

        {/* Clean Map View & Extent Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-surface/60 p-0.5 rounded-lg border border-outline-variant/60">
            <button
              type="button"
              onClick={handleZoomIn}
              className="w-7 h-7 rounded-md bg-surface hover:bg-surface-container-high border border-outline-variant/80 hover:border-secondary flex items-center justify-center font-black text-xs text-primary transition-colors cursor-pointer shadow-xs active:scale-95"
              title="Zoom In (+)"
              aria-label="Zoom In"
            >
              +
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              className="w-7 h-7 rounded-md bg-surface hover:bg-surface-container-high border border-outline-variant/80 hover:border-secondary flex items-center justify-center font-black text-xs text-primary transition-colors cursor-pointer shadow-xs active:scale-95"
              title="Zoom Out (−)"
              aria-label="Zoom Out"
            >
              −
            </button>
            <button
              type="button"
              onClick={handleResetCenter}
              className="px-2 py-1 rounded-md bg-surface hover:bg-surface-container-high border border-outline-variant/80 hover:border-secondary text-[10px] font-mono font-bold text-secondary transition-colors cursor-pointer shadow-xs active:scale-95"
              title="Reset center to initial bounds"
              aria-label="Reset Center"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleFitAllIncidents}
              className="px-2.5 py-1 rounded-md bg-surface hover:bg-surface-container-high border border-outline-variant/80 hover:border-secondary text-[10px] font-mono font-bold text-primary transition-colors cursor-pointer shadow-xs active:scale-95"
              title="Fit map view to all active incident coordinates"
              aria-label="Fit All Incidents"
            >
              Fit All
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default memo(LiveIncidentRadar);
