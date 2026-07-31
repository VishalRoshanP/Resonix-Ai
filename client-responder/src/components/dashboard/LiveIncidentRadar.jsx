import { useState, useMemo, useEffect, useRef } from 'react';
import Card from '../ui/Card';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function LiveIncidentRadar({ incidents = [], onSelectIncident }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);

  const [selectedCluster, setSelectedCluster] = useState(null);
  const [newIncidentNotification, setNewIncidentNotification] = useState(null);
  const [focusedIncidentId, setFocusedIncidentId] = useState(null);

  // Map priority strings to 3 strict levels required:
  // 🔴 Critical | 🟠 Attention | 🔵 Monitoring
  const getRadarPriority = (inc) => {
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
    if (!timestamp) return '1m ago';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '2m ago';
    const diffMins = Math.max(1, Math.floor((Date.now() - date.getTime()) / 60000));
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h ago`;
  };

  // Helper for Icon Mapping
  const getDisasterIcon = (cat) => {
    const c = (cat || 'GENERAL').toUpperCase();
    if (c.includes('FLOOD')) return 'water_drop';
    if (c.includes('FIRE')) return 'local_fire_department';
    if (c.includes('COLLAPSE') || c.includes('STRUCTURAL')) return 'domain_disabled';
    if (c.includes('MEDICAL')) return 'medical_services';
    if (c.includes('STORM') || c.includes('CYCLONE')) return 'cyclone';
    return 'warning';
  };

  // Process & Project Active Incidents to Real GPS Coordinates
  const radarIncidents = useMemo(() => {
    if (!incidents || incidents.length === 0) return [];

    return incidents.map((inc, idx) => {
      const id = String(inc._id || inc.id || inc.packetId || `inc_${idx}`);
      const category = (inc.category || inc.type || inc.aiAnalysis?.disasterCategory || 'GENERAL').toUpperCase();
      const priorityInfo = getRadarPriority(inc);
      const affectedPeople = inc.affectedPeople || inc.aiAnalysis?.peopleCount || inc.visionData?.humanImpact?.estimated_affected_people?.range_band || Math.floor(Math.random() * 20) + 3;
      const timeAgo = getTimeAgo(inc.createdAt || inc.time);

      // Real GPS coordinates (fallback to Sector 4 Bengaluru default if unassigned)
      const lat = inc.location?.lat || inc.latitude || (12.9716 + (idx * 0.007 * (idx % 2 === 0 ? 1 : -1)));
      const lng = inc.location?.lng || inc.longitude || (77.5946 + (idx * 0.007 * (idx % 3 === 0 ? -1 : 1)));

      return {
        ...inc,
        radarId: id,
        category,
        priorityInfo,
        affectedPeople,
        timeAgo,
        lat,
        lng,
        icon: getDisasterIcon(category),
      };
    });
  }, [incidents]);

  // Ribbon Recent Incidents List (Top 5)
  const recentRibbonIncidents = useMemo(() => {
    return radarIncidents.slice(0, 5);
  }, [radarIncidents]);

  // Spatial Clustering: merge incidents within ~0.015 lat/lng distance
  const clusteredRadar = useMemo(() => {
    const clusters = [];
    const visited = new Set();

    radarIncidents.forEach((item, i) => {
      if (visited.has(item.radarId)) return;

      const group = [item];
      visited.add(item.radarId);

      for (let j = i + 1; j < radarIncidents.length; j++) {
        const other = radarIncidents[j];
        if (visited.has(other.radarId)) continue;

        const dist = Math.hypot(item.lat - other.lat, item.lng - other.lng);
        if (dist < 0.012) {
          group.push(other);
          visited.add(other.radarId);
        }
      }

      if (group.length > 1) {
        const avgLat = group.reduce((acc, curr) => acc + curr.lat, 0) / group.length;
        const avgLng = group.reduce((acc, curr) => acc + curr.lng, 0) / group.length;
        const hasCritical = group.some((g) => g.priorityInfo.level === 'CRITICAL');

        clusters.push({
          isCluster: true,
          clusterId: `cluster_${i}`,
          count: group.length,
          items: group,
          lat: avgLat,
          lng: avgLng,
          hasCritical,
        });
      } else {
        clusters.push({
          isCluster: false,
          ...item,
        });
      }
    });

    return clusters;
  }, [radarIncidents]);

  // Initialize Interactive Leaflet OpenStreetMap Instance
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [12.9716, 77.5946],
      zoom: 13,
      zoomControl: false,
    });

    // OpenStreetMap Tile Layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors | RESONIX AI Live Emergency System',
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Custom RESONIX Markers on Leaflet Map
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    const layerGroup = markersLayerRef.current;
    layerGroup.clearLayers();

    clusteredRadar.forEach((item) => {
      if (item.isCluster) {
        const clusterHtml = `
          <div class="px-2.5 py-1 rounded-2xl ${item.hasCritical ? 'bg-red-600 text-white ring-4 ring-red-500/40 animate-pulse' : 'bg-amber-500 text-white shadow-lg'} font-black text-xs border border-white/30 flex items-center gap-1 shadow-2xl cursor-pointer">
            <span class="material-symbols-outlined text-sm">hub</span>
            <span>${item.count} Fused</span>
          </div>
        `;

        const customClusterIcon = L.divIcon({
          html: clusterHtml,
          className: 'custom-cluster-marker',
          iconSize: [90, 30],
          iconAnchor: [45, 15],
        });

        const marker = L.marker([item.lat, item.lng], { icon: customClusterIcon });
        marker.on('click', () => setSelectedCluster(item));
        marker.addTo(layerGroup);
      } else {
        const isFocused = focusedIncidentId === item.radarId;
        const pColor = item.priorityInfo.level === 'CRITICAL' ? 'border-red-500 bg-red-950/90 text-red-400' : item.priorityInfo.level === 'ATTENTION' ? 'border-amber-500 bg-amber-950/90 text-amber-400' : 'border-sky-400 bg-slate-900/90 text-sky-400';
        const badgeColor = item.priorityInfo.badgeColor;

        const markerHtml = `
          <div class="p-2 rounded-2xl border ${pColor} shadow-2xl backdrop-blur-md space-y-0.5 text-left min-w-[125px] cursor-pointer transition-all ${item.priorityInfo.ringStyle} ${isFocused ? 'scale-110' : ''}">
            <div class="flex items-center justify-between gap-1 border-b border-white/10 pb-0.5">
              <span class="font-extrabold text-xs text-white uppercase truncate">${item.category}</span>
              <span class="text-[8px] font-mono font-black px-1.5 py-0.5 rounded ${badgeColor}">${item.priorityInfo.label}</span>
            </div>
            <div class="flex items-center justify-between text-[10px] font-mono text-slate-300 pt-0.5">
              <span class="font-bold">👥 ${item.affectedPeople}</span>
              <span class="text-slate-400">⏱ ${item.timeAgo}</span>
            </div>
          </div>
        `;

        const customMarkerIcon = L.divIcon({
          html: markerHtml,
          className: 'custom-resonix-marker',
          iconSize: [130, 50],
          iconAnchor: [65, 25],
        });

        const marker = L.marker([item.lat, item.lng], { icon: customMarkerIcon });
        marker.on('click', () => {
          setFocusedIncidentId(item.radarId);
          onSelectIncident?.(item);
        });
        marker.addTo(layerGroup);
      }
    });
  }, [clusteredRadar, focusedIncidentId, onSelectIncident]);

  // Track notified critical incident IDs (PREVENTS continuous camera flyTo/zoom jumps)
  const notifiedCriticalIdsRef = useRef(new Set());

  // Show notification banner on NEW Critical Incidents WITHOUT disrupting user camera pan/zoom
  useEffect(() => {
    const criticalInc = radarIncidents.find((i) => i.priorityInfo.level === 'CRITICAL');
    if (criticalInc && !notifiedCriticalIdsRef.current.has(criticalInc.radarId)) {
      notifiedCriticalIdsRef.current.add(criticalInc.radarId);
      setNewIncidentNotification(`🚨 New Critical Incident: ${criticalInc.category} in ${criticalInc.sector || criticalInc.location?.address || 'Live Telemetry Location'}`);
      const timer = setTimeout(() => setNewIncidentNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [radarIncidents]);

  const handleRibbonItemClick = (inc) => {
    setFocusedIncidentId(inc.radarId);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([inc.lat, inc.lng], 15, { duration: 1.2 });
    }
    onSelectIncident?.(inc);
  };

  const handleZoomIn = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomOut();
  };

  const handleResetCenter = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.flyTo([12.9716, 77.5946], 13);
  };

  const handleFitAllIncidents = () => {
    if (!mapInstanceRef.current || radarIncidents.length === 0) return;
    const validCoords = radarIncidents.map((inc) => [inc.lat, inc.lng]).filter(([a, b]) => !isNaN(a) && !isNaN(b));
    if (validCoords.length > 0) {
      const bounds = L.latLngBounds(validCoords);
      if (bounds.isValid()) {
        mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      }
    }
  };

  return (
    <Card className="p-0 border border-outline-variant/60 shadow-xl overflow-hidden relative bg-surface-container-lowest">
      {/* ==================================================================== */}
      {/* 1. LIVE INCIDENT HORIZONTAL RIBBON */}
      {/* ==================================================================== */}
      <div className="bg-surface-container-high/90 border-b border-outline-variant/60 p-2.5 px-4 flex items-center justify-between gap-3 text-xs overflow-x-auto z-20 relative">
        <div className="flex items-center gap-2 shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-error animate-ping" />
          <span className="font-mono font-black text-primary uppercase text-[11px] tracking-wider flex items-center gap-1">
            <span className="material-symbols-outlined text-sm text-secondary">map</span>
            <span>LIVE INCIDENT MAP RIBBON</span>
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5">
          {recentRibbonIncidents.map((inc) => (
            <button
              key={inc.radarId}
              onClick={() => handleRibbonItemClick(inc)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-surface border border-outline-variant/60 hover:border-secondary transition-all cursor-pointer shrink-0 text-[11px] font-bold shadow-xs hover:scale-105"
            >
              <span>{inc.priorityInfo.iconEmoji}</span>
              <span className="text-primary uppercase font-extrabold">{inc.category}</span>
              <span className="text-[10px] font-mono text-on-surface-variant">• {inc.timeAgo}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Auto Focus Critical Incident Notification Banner */}
      {newIncidentNotification && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-2xl bg-error text-white font-black text-xs shadow-2xl flex items-center gap-2 animate-bounce border border-white/20">
          <span className="material-symbols-outlined text-base">emergency</span>
          <span>{newIncidentNotification}</span>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. REAL INTERACTIVE OPENSTREETMAP CANVAS */}
      {/* ==================================================================== */}
      <div className="relative w-full h-[400px] sm:h-[460px] bg-slate-900 z-10">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Cluster Expansion Modal Overlay */}
        {selectedCluster && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xs z-40 flex items-center justify-center p-4">
            <Card className="bg-slate-900 border border-outline-variant max-w-md w-full p-4 space-y-3 shadow-2xl">
              <div className="flex items-center justify-between border-b border-outline-variant/60 pb-2">
                <span className="text-xs font-mono font-black text-secondary uppercase flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base">hub</span>
                  <span>Cluster Details ({selectedCluster.count} Incidents)</span>
                </span>
                <button onClick={() => setSelectedCluster(null)} className="text-on-surface-variant hover:text-primary cursor-pointer">
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {selectedCluster.items.map((inc) => (
                  <div
                    key={inc.radarId}
                    onClick={() => {
                      setSelectedCluster(null);
                      handleRibbonItemClick(inc);
                    }}
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-outline-variant/60 flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div>
                      <span className="font-black text-xs text-primary block">{inc.category} Emergency</span>
                      <span className="text-[10px] text-on-surface-variant font-mono">Location: {inc.sector || inc.location?.address || 'Live Telemetry Location'} • {inc.timeAgo}</span>
                    </div>
                    <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded ${inc.priorityInfo.badgeColor}`}>
                      {inc.priorityInfo.label}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* 3. CONTROLS & THREE-LEVEL PRIORITY LEGEND */}
      {/* ==================================================================== */}
      <div className="p-3 bg-surface-container border-t border-outline-variant/60 flex flex-wrap items-center justify-between gap-3 text-xs z-20 relative">
        {/* Strict Three Priority Levels Legend */}
        <div className="flex items-center gap-4 font-mono text-[11px]">
          <span className="flex items-center gap-1.5 font-extrabold text-error">
            <span>🔴</span>
            <span>Critical</span>
          </span>
          <span className="flex items-center gap-1.5 font-extrabold text-amber-500">
            <span>🟠</span>
            <span>Attention</span>
          </span>
          <span className="flex items-center gap-1.5 font-extrabold text-sky-400">
            <span>🔵</span>
            <span>Monitoring</span>
          </span>
        </div>

        {/* Map & Zoom Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomIn}
            className="w-7 h-7 rounded-lg bg-surface border border-outline-variant hover:border-secondary flex items-center justify-center font-black text-primary cursor-pointer"
            title="Zoom In"
          >
            +
          </button>
          <button
            onClick={handleZoomOut}
            className="w-7 h-7 rounded-lg bg-surface border border-outline-variant hover:border-secondary flex items-center justify-center font-black text-primary cursor-pointer"
            title="Zoom Out"
          >
            -
          </button>
          <button
            onClick={handleResetCenter}
            className="px-2.5 py-1 rounded-lg bg-surface border border-outline-variant hover:border-secondary text-[10px] font-mono font-bold text-secondary cursor-pointer"
          >
            Reset Center
          </button>
          <button
            onClick={handleFitAllIncidents}
            className="px-2.5 py-1 rounded-lg bg-surface border border-outline-variant hover:border-secondary text-[10px] font-mono font-bold text-primary cursor-pointer"
            title="Fit view to show all active markers"
          >
            Fit All Incidents
          </button>
        </div>
      </div>
    </Card>
  );
}
