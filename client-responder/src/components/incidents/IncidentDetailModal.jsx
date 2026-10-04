import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Card from '../ui/Card';
import Button from '../ui/Button';
import LiveDeviceRelayPath from '../dashboard/LiveDeviceRelayPath';
import { incidentApi, resourceApi, weatherApi } from '../../services/api';
import useSocket from '../../hooks/useSocket';
import { getIncidentCategoryStyle } from '../../utils/mapIncidentNormalizer';
import { useLanguage } from '../../contexts/LanguageContext';

/**
 * Deterministic Geographic Distance (Haversine formula in pure JavaScript)
 */
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (
    lat1 == null ||
    lon1 == null ||
    lat2 == null ||
    lon2 == null ||
    isNaN(lat1) ||
    isNaN(lon1) ||
    isNaN(lat2) ||
    isNaN(lon2)
  ) {
    return null;
  }
  const R = 6371; // Earth radius in km
  const dLat = ((Number(lat2) - Number(lat1)) * Math.PI) / 180;
  const dLon = ((Number(lon2) - Number(lon1)) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((Number(lat1) * Math.PI) / 180) *
      Math.cos((Number(lat2) * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const dist = R * c;
  return Math.round(dist * 10) / 10;
}

/**
 * Deterministic Category Compatibility Rules
 */
function evaluateCategoryCompatibility(incidentCategory, resource) {
  const cat = (incidentCategory || 'GENERAL').toUpperCase();
  const resType = (resource.type || resource.category || '').toUpperCase();
  const resName = (resource.name || '').toUpperCase();

  let isPreferred = false;
  let suitabilityLabel = 'Available Unit';

  if (cat.includes('LANDSLIDE') || cat.includes('MUDSLIDE')) {
    if (resType.includes('RESCUE') || resName.includes('RESCUE') || resType.includes('EQUIP') || resName.includes('EARTH') || resName.includes('BULLDOZER')) {
      isPreferred = true;
      suitabilityLabel = 'Heavy Earth Rescue Support';
    } else if (resType.includes('SEARCH') || resName.includes('SEARCH') || resName.includes('K9')) {
      isPreferred = true;
      suitabilityLabel = 'Slope Search & Rescue';
    } else if (resType.includes('MEDIC') || resType.includes('AMBULANCE')) {
      isPreferred = true;
      suitabilityLabel = 'Trauma / Medical Support';
    }
  } else if (cat.includes('FOREST_FIRE') || cat.includes('WILDFIRE')) {
    if (resType.includes('FIRE') || resName.includes('FIRE')) {
      isPreferred = true;
      suitabilityLabel = 'Wildfire Suppression';
    } else if (resType.includes('RESCUE') || resType.includes('EQUIP')) {
      isPreferred = true;
      suitabilityLabel = 'Perimeter Rescue Support';
    }
  } else if (cat.includes('FIRE')) {
    if (resType.includes('FIRE') || resName.includes('FIRE')) {
      isPreferred = true;
      suitabilityLabel = 'Fire Suppression';
    } else if (resType.includes('RESCUE') || resName.includes('RESCUE') || resType.includes('EQUIP')) {
      isPreferred = true;
      suitabilityLabel = 'Rescue Support';
    }
  } else if (cat.includes('TSUNAMI')) {
    if (resType.includes('WATER') || resName.includes('WATER') || resName.includes('BOAT')) {
      isPreferred = true;
      suitabilityLabel = 'Coastal Evacuation & Boat Rescue';
    } else if (resType.includes('RESCUE') || resType.includes('MEDIC')) {
      isPreferred = true;
      suitabilityLabel = 'Disaster Triage Support';
    }
  } else if (cat.includes('FLOOD')) {
    if (resType.includes('WATER') || resName.includes('WATER') || resName.includes('BOAT')) {
      isPreferred = true;
      suitabilityLabel = 'Swift Water Rescue';
    } else if (resType.includes('RESCUE') || resType.includes('EQUIP') || resType.includes('MEDIC')) {
      isPreferred = true;
      suitabilityLabel = 'Flood Rescue Support';
    }
  } else if (cat.includes('AVALANCHE')) {
    if (resType.includes('SEARCH') || resName.includes('SEARCH') || resName.includes('K9') || resType.includes('RESCUE')) {
      isPreferred = true;
      suitabilityLabel = 'Snow Search & Rescue';
    }
  } else if (cat.includes('CHEMICAL') || cat.includes('HAZMAT') || cat.includes('NUCLEAR') || cat.includes('BIOLOGICAL')) {
    if (resType.includes('HAZMAT') || resName.includes('HAZMAT') || resType.includes('RESCUE') || resType.includes('MEDIC')) {
      isPreferred = true;
      suitabilityLabel = 'Hazmat / Containment Triage';
    }
  } else if (cat.includes('MEDIC')) {
    if (resType.includes('AMBULANCE') || resType.includes('MEDIC') || resName.includes('MEDIC') || resName.includes('AMBULANCE')) {
      isPreferred = true;
      suitabilityLabel = 'Medical / Ambulance';
    }
  } else if (cat.includes('BUILDING') || cat.includes('COLLAPSE') || cat.includes('STRUCTURAL')) {
    if (resType.includes('SEARCH') || resName.includes('SEARCH') || resName.includes('K9') || resName.includes('COLLAPSE')) {
      isPreferred = true;
      suitabilityLabel = 'Search & Rescue';
    } else if (resType.includes('RESCUE') || resType.includes('EQUIP') || resType.includes('FIRE')) {
      isPreferred = true;
      suitabilityLabel = 'Heavy Rescue Support';
    }
  } else if (cat.includes('EARTHQUAKE')) {
    if (resType.includes('SEARCH') || resName.includes('SEARCH') || resType.includes('MEDIC') || resType.includes('RESCUE') || resType.includes('AMBULANCE')) {
      isPreferred = true;
      suitabilityLabel = 'Urban Search & Medical';
    }
  } else if (cat.includes('CYCLONE') || cat.includes('STORM') || cat.includes('SQUALL')) {
    if (resType.includes('RESCUE') || resType.includes('WATER') || resType.includes('MEDIC') || resType.includes('EQUIP')) {
      isPreferred = true;
      suitabilityLabel = 'Storm Rescue Support';
    }
  } else {
    isPreferred = true;
    suitabilityLabel = 'Emergency Resource';
  }

  return { isPreferred, suitabilityLabel };
}

export default function IncidentDetailModal({ incident, isOpen, onClose, onUpdateIncident }) {
  // 1. All React hooks declared unconditionally at top level
  const { t, currentLanguage } = useLanguage();
  const [activeIncident, setActiveIncident] = useState(incident);
  const [isNewlyEnriched, setIsNewlyEnriched] = useState(false);

  const [realResources, setRealResources] = useState([]);
  const [loadingRealResources, setLoadingRealResources] = useState(false);
  const [assignConfirmResource, setAssignConfirmResource] = useState(null);
  const [isAssigningResource, setIsAssigningResource] = useState(false);
  const [isReleasingResource, setIsReleasingResource] = useState(false);
  const [resourceToast, setResourceToast] = useState({ message: '', type: 'success' });

  const [deploymentTimestamp, setDeploymentTimestamp] = useState(null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');
  const [isCompleting, setIsCompleting] = useState(false);
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [acknowledgement, setAcknowledgement] = useState(null);
  const [deploymentSuccessMsg, setDeploymentSuccessMsg] = useState('');
  const [assignedTeam, setAssignedTeam] = useState('');
  const [priority, setPriority] = useState('UNASSIGNED');
  const [status, setStatus] = useState('OPEN');
  const [newNote, setNewNote] = useState('');
  const [internalNotes, setInternalNotes] = useState([]);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [gpsUnavailableMsg, setGpsUnavailableMsg] = useState(false);
  const [weatherContext, setWeatherContext] = useState(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);

  // Collapsible sections (advanced evidence collapsed by default for progressive disclosure)
  const [collapsedSections, setCollapsedSections] = useState({
    location: false,
    report: false,
    evidence: false,
    aiTriage: false,
    weather: false,
    response: false,
    advancedEvidence: true,
  });

  const toggleSection = (key) => {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const navigate = useNavigate();

  const { lastSocketEvent } = useSocket(true);

  // Synchronize internal active incident whenever prop changes
  useEffect(() => {
    setActiveIncident(incident);
  }, [incident]);

  // Fetch real operational resources from MongoDB
  const fetchRealResources = useCallback(async () => {
    try {
      setLoadingRealResources(true);
      const data = await resourceApi.getResources();
      const list = Array.isArray(data) ? data : (Array.isArray(data?.resources) ? data.resources : []);
      setRealResources(list);
    } catch (err) {
      console.warn('[IncidentDetailModal] Failed to fetch real resources:', err.message);
      setRealResources([]);
    } finally {
      setLoadingRealResources(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchRealResources();
    }
  }, [isOpen, fetchRealResources]);

  // Real-Time Socket.IO event listener: updates resources AND enriched AI fields without page refresh
  useEffect(() => {
    if (!lastSocketEvent) return;

    if (['RESOURCE_UPDATED', 'INCIDENT_UPDATED'].includes(lastSocketEvent.type)) {
      fetchRealResources();
    }

    // Real-Time Enriched AI Ingestion for currently displayed incident
    if (['INCIDENT_UPDATED', 'incident:updated'].includes(lastSocketEvent.type)) {
      const updateData = lastSocketEvent.incident || lastSocketEvent;
      const targetId = String(
        lastSocketEvent.incidentId ||
        updateData?._id ||
        updateData?.id ||
        updateData?.packetId ||
        ''
      );
      const curId = String(
        incident?._id ||
        incident?.id ||
        incident?.packetId ||
        incident?.clientRequestId ||
        ''
      );

      if (targetId && curId && (targetId === curId || curId.includes(targetId) || targetId.includes(curId))) {
        setActiveIncident((prev) => ({
          ...(prev || {}),
          ...(updateData || {}),
          status: (lastSocketEvent.status || updateData.status || prev?.status || 'OPEN').toUpperCase(),
        }));
        // Subtle 2s indicator of real-time AI enrichment
        setIsNewlyEnriched(true);
        setTimeout(() => setIsNewlyEnriched(false), 2200);
      }
    }
  }, [lastSocketEvent, fetchRealResources, incident]);

  // ESC Key Navigation Listener to close panel cleanly
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isOpen && e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Modal Scroll Isolation & Background Page Scroll Lock
  useEffect(() => {
    if (!isOpen) return;

    // 1. Capture exact current scroll positions
    const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    const scrollX = window.scrollX || document.documentElement.scrollLeft || 0;

    // Find main layout scroll container in ResponderLayout
    const mainContainer =
      document.querySelector('main > div.overflow-y-auto') ||
      document.querySelector('main .overflow-y-auto');
    const containerScrollTop = mainContainer ? mainContainer.scrollTop : 0;
    const containerScrollLeft = mainContainer ? mainContainer.scrollLeft : 0;

    // Calculate vertical scrollbar width to prevent horizontal layout shift
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    // 2. Snapshot previous inline styles
    const prevBodyPosition = document.body.style.position;
    const prevBodyTop = document.body.style.top;
    const prevBodyLeft = document.body.style.left;
    const prevBodyWidth = document.body.style.width;
    const prevBodyPaddingRight = document.body.style.paddingRight;
    const prevDocOverflow = document.documentElement.style.overflow;
    const prevContainerOverflow = mainContainer ? mainContainer.style.overflow : '';

    // 3. Lock document body and documentElement
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = `-${scrollX}px`;
    document.body.style.width = '100%';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    document.documentElement.style.overflow = 'hidden';

    // 4. Lock main incidents page scroll container
    if (mainContainer) {
      mainContainer.style.overflow = 'hidden';
      mainContainer.scrollTop = containerScrollTop;
      mainContainer.scrollLeft = containerScrollLeft;
    }

    return () => {
      // 5. Restore document body and documentElement
      document.body.style.position = prevBodyPosition;
      document.body.style.top = prevBodyTop;
      document.body.style.left = prevBodyLeft;
      document.body.style.width = prevBodyWidth;
      document.body.style.paddingRight = prevBodyPaddingRight;
      document.documentElement.style.overflow = prevDocOverflow;

      // Restore exact window scroll coordinates
      window.scrollTo(scrollX, scrollY);

      // 6. Restore main incidents container
      if (mainContainer) {
        mainContainer.style.overflow = prevContainerOverflow;
        mainContainer.scrollTop = containerScrollTop;
        mainContainer.scrollLeft = containerScrollLeft;
      }
    };
  }, [isOpen]);

  // Synchronize internal state whenever active incident changes
  useEffect(() => {
    const cur = activeIncident || incident;
    if (cur) {
      setAcknowledgement(cur.acknowledgement || cur.rawDoc?.acknowledgement || null);
      setDeploymentTimestamp(cur.deployedAt || null);
      const realUnit = cur.assignedResponders?.[0]?.name || cur.assignedUnit || cur.gemmaAnalysis?.recommendedResponseTeam || 'Pending Responder Assignment';
      setAssignedTeam(realUnit);
      setPriority((cur.priority || cur.gemmaAnalysis?.priority || cur.severity || 'UNASSIGNED').toUpperCase());
      setStatus((cur.status || 'OPEN').toUpperCase());
      setInternalNotes(Array.isArray(cur.notes) ? cur.notes : []);
    }
  }, [activeIncident, incident]);

  // Use current active incident (reacts to real-time updates)
  const currentInc = activeIncident || incident;

  const incidentId = currentInc ? String(currentInc._id || currentInc.id || currentInc.packetId || '') : '';
  const incidentDisplayId = currentInc?.displayId || (incidentId.length > 8 ? `INC-${incidentId.slice(-4).toUpperCase()}` : (incidentId ? `INC-${incidentId}` : 'INC-0000'));
  const incLat = currentInc ? (
    currentInc.location?.lat ??
    currentInc.location?.latitude ??
    currentInc.rawDoc?.location?.lat ??
    currentInc.rawDoc?.location?.latitude ??
    currentInc.latitude ??
    currentInc.rawDoc?.latitude ??
    currentInc.gpsCoordinates?.latitude ??
    currentInc.gpsCoordinates?.lat ??
    currentInc.rawDoc?.gpsCoordinates?.latitude ??
    currentInc.rawDoc?.gpsCoordinates?.lat ??
    (Array.isArray(currentInc.location?.coordinates) && currentInc.location.coordinates.length >= 2 ? currentInc.location.coordinates[1] : null) ??
    (Array.isArray(currentInc.coordinates) && currentInc.coordinates.length >= 2 ? currentInc.coordinates[1] : null) ??
    null
  ) : null;

  const incLng = currentInc ? (
    currentInc.location?.lng ??
    currentInc.location?.longitude ??
    currentInc.rawDoc?.location?.lng ??
    currentInc.rawDoc?.location?.longitude ??
    currentInc.longitude ??
    currentInc.rawDoc?.longitude ??
    currentInc.gpsCoordinates?.longitude ??
    currentInc.gpsCoordinates?.lng ??
    currentInc.rawDoc?.gpsCoordinates?.longitude ??
    currentInc.rawDoc?.gpsCoordinates?.lng ??
    (Array.isArray(currentInc.location?.coordinates) && currentInc.location.coordinates.length >= 2 ? currentInc.location.coordinates[0] : null) ??
    (Array.isArray(currentInc.coordinates) && currentInc.coordinates.length >= 2 ? currentInc.coordinates[0] : null) ??
    null
  ) : null;
  const accuracy = currentInc?.location?.accuracy ?? currentInc?.location?.accuracyMeters ?? currentInc?.gpsCoordinates?.accuracy ?? currentInc?.gpsCoordinates?.accuracyMeters ?? currentInc?.accuracy ?? null;

  // Exact GPS validity check (prevents navigating to random/default coordinates if GPS missing)
  const hasValidGps = Boolean(
    incLat != null &&
    incLng != null &&
    !isNaN(Number(incLat)) &&
    !isNaN(Number(incLng)) &&
    Number(incLat) !== 0 &&
    Number(incLng) !== 0
  );

  // Navigate to existing Responder Dashboard Map and focus on this exact incident's GPS
  const handleViewOnMap = (e) => {
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    if (!hasValidGps) {
      setGpsUnavailableMsg(true);
      setTimeout(() => setGpsUnavailableMsg(false), 2500);
      return;
    }

    // Cleanly close modal so map is immediately visible
    onClose?.();

    const targetLat = Number(incLat);
    const targetLng = Number(incLng);
    const rawId = currentInc._id || currentInc.id || currentInc.packetId || incidentId;

    navigate(`/dashboard?incident=${encodeURIComponent(incidentDisplayId)}&lat=${encodeURIComponent(targetLat)}&lng=${encodeURIComponent(targetLng)}`, {
      state: {
        focusIncidentId: rawId,
        displayId: incidentDisplayId,
        lat: targetLat,
        lng: targetLng,
      },
    });
  };

  // Fetch real localized weather context for this incident's coordinates
  useEffect(() => {
    if (!isOpen || incLat == null || incLng == null) return;
    const lat = Number(incLat);
    const lon = Number(incLng);
    if (isNaN(lat) || isNaN(lon)) return;

    let isMounted = true;
    setIsLoadingWeather(true);
    weatherApi.getComprehensive(lat, lon)
      .then((res) => {
        if (isMounted) {
          setWeatherContext(res?.data || res);
        }
      })
      .catch((err) => {
        console.debug('[IncidentDetailModal] Weather fetch note:', err.message);
      })
      .finally(() => {
        if (isMounted) setIsLoadingWeather(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, incLat, incLng]);

  const category = (
    currentInc?.detectedCategory ||
    currentInc?.rawDoc?.detectedCategory ||
    currentInc?.detectedEmergencyCategory ||
    currentInc?.rawDoc?.detectedEmergencyCategory ||
    currentInc?.category ||
    currentInc?.rawDoc?.category ||
    currentInc?.aiAssessment?.category ||
    currentInc?.aiAnalysis?.disasterCategory ||
    'OTHER'
  ).toUpperCase();

  // Category Icon / Emoji helper (uses centralized style mapping)
  const getCategoryIcon = (cat) => {
    return getIncidentCategoryStyle(cat).emoji || '🚨';
  };

  // Real currently assigned units on this incident from database
  const currentlyAssignedUnits = useMemo(() => {
    if (!incidentId) return [];
    return realResources.filter(
      (r) =>
        (r.assignedIncidentId && String(r.assignedIncidentId) === incidentId) ||
        (r.currentMission && incidentDisplayId && r.currentMission.toUpperCase().includes(incidentDisplayId.toUpperCase()))
    );
  }, [realResources, incidentId, incidentDisplayId]);

  // Real suitable available resources, scored, distance-computed, and sorted
  const sortedAvailableResources = useMemo(() => {
    if (!currentInc) return [];
    return realResources
      .filter((r) => !currentlyAssignedUnits.some((a) => String(a.id || a._id) === String(r.id || r._id)))
      .map((r) => {
        const resLat = r.gpsCoordinates?.latitude ?? r.gpsCoordinates?.lat ?? null;
        const resLng = r.gpsCoordinates?.longitude ?? r.gpsCoordinates?.lng ?? null;
        const distanceKm = calculateDistanceKm(incLat, incLng, resLat, resLng);
        const distanceText = distanceKm != null ? `${distanceKm} km away` : 'Location unavailable';
        const { isPreferred, suitabilityLabel } = evaluateCategoryCompatibility(category, r);
        const isAvailable = (r.status || 'AVAILABLE').toUpperCase() === 'AVAILABLE';

        return {
          ...r,
          distanceKm,
          distanceText,
          isPreferred,
          suitabilityLabel,
          isAvailable,
        };
      })
      .sort((a, b) => {
        if (a.isAvailable !== b.isAvailable) return a.isAvailable ? -1 : 1;
        if (a.isPreferred !== b.isPreferred) return a.isPreferred ? -1 : 1;
        if (a.distanceKm != null && b.distanceKm != null) return a.distanceKm - b.distanceKm;
        if (a.distanceKm != null) return -1;
        if (b.distanceKm != null) return 1;
        return 0;
      });
  }, [realResources, currentlyAssignedUnits, incLat, incLng, category, currentInc]);

  // 2. Early return placed safely after all hook declarations
  if (!isOpen || !currentInc) return null;

  const PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  const STATUSES = ['OPEN', 'DISPATCHED', 'EN_ROUTE', 'ON_SCENE', 'RESOLVED', 'CLOSED'];

  const imgData = currentInc.imageAnalysis || currentInc.rawDoc?.imageAnalysis || null;
  const aiAnalysis = currentInc.gemmaAnalysis || currentInc.aiAnalysis || {};

  // Timestamp Formatter
  const formatRealTimestamp = (dateVal) => {
    if (!dateVal || dateVal === 'Pending') return 'Pending';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return String(dateVal);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    } catch (_) {
      return String(dateVal);
    }
  };

  const formatReportedTime = (dateVal) => {
    if (!dateVal || dateVal === 'Pending') return '09:13 PM';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '09:13 PM';
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch (_) {
      return String(dateVal);
    }
  };

  const receivedTimeStr = formatRealTimestamp(currentInc.responseLifecycle?.receivedAt || currentInc.createdAt || currentInc.timestamp || currentInc.time);
  const reportedTimeStr = formatReportedTime(currentInc.responseLifecycle?.receivedAt || currentInc.createdAt || currentInc.timestamp || currentInc.time);

  // Status Badge Colors
  const getBadgeStyle = (st) => {
    const upper = (st || '').toUpperCase();
    if (upper === 'CRITICAL' || upper === 'HIGH') return 'bg-rose-500/20 text-rose-300 border border-rose-500/50 font-bold';
    if (upper === 'DISPATCHED' || upper === 'EN_ROUTE') return 'bg-amber-500/20 text-amber-300 border border-amber-500/50 font-bold';
    if (upper === 'IN_PROGRESS' || upper === 'ON_SCENE') return 'bg-sky-500/20 text-sky-300 border border-sky-500/50 font-bold';
    if (upper === 'RESOLVED' || upper === 'CLOSED' || upper === 'COMPLETED') return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 font-bold';
    return 'bg-slate-700/50 text-slate-300 border border-slate-600 font-medium';
  };

  // Priority Badge Helper with slow subtle pulse for CRITICAL
  const getPriorityBadgeStyle = (prio) => {
    const upper = (prio || '').toUpperCase();
    if (upper === 'CRITICAL') {
      return 'bg-rose-500/20 text-rose-300 border border-rose-500/70 font-black shadow-xs shadow-rose-950/40 animate-pulse-slow';
    }
    if (upper === 'HIGH' || upper === 'WARNING') {
      return 'bg-amber-500/20 text-amber-300 border border-amber-500/50 font-bold';
    }
    if (upper === 'MEDIUM') {
      return 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-semibold';
    }
    return 'bg-slate-700/50 text-slate-300 border border-slate-600 font-medium';
  };

  // Status Action Handlers
  const handleAssignResourceClick = (res) => {
    setAssignConfirmResource(res);
  };

  const handleConfirmAssignment = async () => {
    if (!assignConfirmResource || !currentInc) return;
    try {
      setIsAssigningResource(true);
      await resourceApi.assignResource({
        resourceId: String(assignConfirmResource.id || assignConfirmResource._id),
        incidentId,
        etaMinutes: 10,
        notes: `Tactical dispatch to ${incidentDisplayId} (${category})`,
        assignedBy: 'Commander',
      });

      setResourceToast({ message: `Assigned '${assignConfirmResource.name}' to incident.`, type: 'success' });
      setAssignConfirmResource(null);
      await fetchRealResources();

      const unitName = assignConfirmResource.name;
      setAssignedTeam(unitName);
      if (currentInc) {
        currentInc.assignedUnit = unitName;
      }
      onUpdateIncident?.({
        ...currentInc,
        assignedUnit: unitName,
      });

      setTimeout(() => setResourceToast({ message: '', type: 'success' }), 3500);
    } catch (err) {
      console.error('[IncidentDetailModal] Resource assignment failed:', err.message);
      setResourceToast({
        message: err.data?.message || err.message || 'Failed to assign resource.',
        type: 'error',
      });
    } finally {
      setIsAssigningResource(false);
    }
  };

  const handleReleaseResource = async (resUnit) => {
    if (!resUnit) return;
    try {
      setIsReleasingResource(true);
      const resId = String(resUnit.id || resUnit._id);
      await resourceApi.releaseResource(resId);

      setResourceToast({ message: `Resource '${resUnit.name}' released to AVAILABLE.`, type: 'success' });
      await fetchRealResources();
      setTimeout(() => setResourceToast({ message: '', type: 'success' }), 3500);
    } catch (err) {
      console.error('[IncidentDetailModal] Resource release failed:', err.message);
      setResourceToast({
        message: err.data?.message || err.message || 'Failed to release resource.',
        type: 'error',
      });
    } finally {
      setIsReleasingResource(false);
    }
  };

  const handleConfirmComplete = async () => {
    setIsCompleting(true);
    try {
      const notesToSave = completionNotes.trim() || 'Emergency successfully resolved by response team.';
      const nowIso = new Date().toISOString();

      const updatePayload = {
        status: 'RESOLVED',
        completedAt: nowIso,
        completedBy: 'Command Officer',
        completionNotes: notesToSave,
        resolutionSummary: notesToSave,
      };

      const targetId = currentInc.rawDoc?._id || currentInc._id || currentInc.rawDoc?.id || currentInc.id || currentInc.packetId || currentInc.clientRequestId;
      if (!targetId) {
        throw new Error('Valid incident ID could not be determined.');
      }
      await incidentApi.updateIncident(targetId, updatePayload);

      setStatus('RESOLVED');

      const updatedIncident = {
        ...currentInc,
        ...updatePayload,
        status: 'RESOLVED',
        currentLifecycleStage: 5,
      };

      setActiveIncident(updatedIncident);
      onUpdateIncident?.(updatedIncident);
      setDeploymentSuccessMsg('Rescue operations marked as RESOLVED.');
      setShowCompleteModal(false);
      setTimeout(() => {
        setDeploymentSuccessMsg('');
        onClose();
      }, 1200);
    } catch (err) {
      console.error('[IncidentDetailModal] Complete incident backend exception:', err);
      setDeploymentSuccessMsg('Unable to mark this emergency as resolved. Please try again.');
    } finally {
      setIsCompleting(false);
    }
  };

  const handleAcknowledgeAlert = async () => {
    if (!currentInc || acknowledgement?.status === 'ACKNOWLEDGED' || isAcknowledging) return;
    const targetId = currentInc._id || currentInc.id || currentInc.rawDoc?._id || currentInc.rawDoc?.id;
    setIsAcknowledging(true);
    try {
      const responderName = currentInc.assignedResponders?.[0]?.name || currentInc.assignedUnit || assignedTeam || 'Officer J. Miller';
      const res = await incidentApi.acknowledgeIncident(targetId, { responderName });

      const updatedAck = res?.data?.acknowledgement || res?.acknowledgement || {
        status: 'ACKNOWLEDGED',
        acknowledgedAt: new Date().toISOString(),
        acknowledgedBy: responderName,
      };

      setAcknowledgement(updatedAck);
      setDeploymentSuccessMsg('Emergency Alert Acknowledged.');
      const nextInc = { ...currentInc, acknowledgement: updatedAck };
      setActiveIncident(nextInc);
      onUpdateIncident?.(nextInc);
      setTimeout(() => setDeploymentSuccessMsg(''), 3000);
    } catch (err) {
      console.error('[IncidentDetailModal] Acknowledge alert error:', err);
      setDeploymentSuccessMsg('Unable to send responder acknowledgement. Please try again.');
    } finally {
      setIsAcknowledging(false);
    }
  };

  const handleDispatchIncident = async () => {
    if (!currentInc || isUpdatingStatus) return;
    const targetId = currentInc._id || currentInc.id || currentInc.rawDoc?._id || currentInc.rawDoc?.id;
    setIsUpdatingStatus(true);
    try {
      await incidentApi.updateIncident(targetId, { status: 'dispatched' });
      setStatus('DISPATCHED');
      const nowIso = new Date().toISOString();
      setDeploymentTimestamp(nowIso);
      const nextInc = { ...currentInc, status: 'dispatched', deployedAt: nowIso };
      setActiveIncident(nextInc);
      onUpdateIncident?.(nextInc);
      setDeploymentSuccessMsg('Response dispatched. Status updated.');
      setTimeout(() => setDeploymentSuccessMsg(''), 3000);
    } catch (err) {
      console.error('[IncidentDetailModal] Dispatch error:', err);
      setDeploymentSuccessMsg('Unable to update dispatch status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleStartRescue = async () => {
    if (!currentInc || isUpdatingStatus) return;
    const targetId = currentInc._id || currentInc.id || currentInc.rawDoc?._id || currentInc.rawDoc?.id;
    setIsUpdatingStatus(true);
    try {
      await incidentApi.updateIncident(targetId, { status: 'in_progress' });
      setStatus('IN_PROGRESS');
      const nextInc = { ...currentInc, status: 'in_progress' };
      setActiveIncident(nextInc);
      onUpdateIncident?.(nextInc);
      setDeploymentSuccessMsg('Rescue operations in progress on scene.');
      setTimeout(() => setDeploymentSuccessMsg(''), 3000);
    } catch (err) {
      console.error('[IncidentDetailModal] Start rescue error:', err);
      setDeploymentSuccessMsg('Unable to update rescue status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleAddNote = (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    const noteObj = {
      id: Date.now(),
      author: 'Command Officer',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: newNote.trim(),
    };

    setInternalNotes([...internalNotes, noteObj]);
    setNewNote('');
  };

  const handleSaveChanges = () => {
    const updated = {
      ...currentInc,
      assignedUnit: assignedTeam,
      priority,
      status,
      notes: internalNotes,
      deployedResources: currentlyAssignedUnits,
      deployedAt: deploymentTimestamp,
    };
    onUpdateIncident?.(updated);
    setDeploymentSuccessMsg('Incident details updated successfully.');
    setTimeout(() => {
      setDeploymentSuccessMsg('');
      onClose();
    }, 1000);
  };

  // Real backend status mappings for 5-step lifecycle
  const currentStatusUpper = (currentInc.status || status || 'OPEN').toUpperCase();
  const isAck = acknowledgement?.status === 'ACKNOWLEDGED';
  const isDisp = ['DISPATCHED', 'EN_ROUTE', 'IN_PROGRESS', 'ON_SCENE', 'RESOLVED', 'CLOSED', 'COMPLETED'].includes(currentStatusUpper) || Boolean(deploymentTimestamp);
  const isInProg = ['IN_PROGRESS', 'ON_SCENE', 'RESOLVED', 'CLOSED', 'COMPLETED'].includes(currentStatusUpper);
  const isDone = ['RESOLVED', 'CLOSED', 'COMPLETED'].includes(currentStatusUpper);

  const STATUS_STEPS = [
    { key: 'received', label: 'Alert Received', done: true, current: !isAck && !isDisp && !isInProg && !isDone, time: receivedTimeStr },
    { key: 'acknowledged', label: 'Acknowledged', done: isAck || isDisp || isInProg || isDone, current: isAck && !isDisp && !isInProg && !isDone, time: acknowledgement?.acknowledgedAt ? formatRealTimestamp(acknowledgement.acknowledgedAt) : (isAck ? 'Verified' : 'Pending') },
    { key: 'dispatched', label: 'Response Dispatched', done: isDisp || isInProg || isDone, current: isDisp && !isInProg && !isDone, time: deploymentTimestamp ? formatRealTimestamp(deploymentTimestamp) : (currentInc.responseLifecycle?.dispatchTime ? formatRealTimestamp(currentInc.responseLifecycle.dispatchTime) : 'Pending') },
    { key: 'in_progress', label: 'Rescue In Progress', done: isInProg || isDone, current: (currentStatusUpper === 'IN_PROGRESS' || currentStatusUpper === 'ON_SCENE') && !isDone, time: currentInc.responseLifecycle?.arrivalTime ? formatRealTimestamp(currentInc.responseLifecycle.arrivalTime) : (isInProg && !isDone ? 'Active' : 'Pending') },
    { key: 'completed', label: 'Rescue Completed', done: isDone, current: isDone, time: currentInc.completedAt || currentInc.resolvedAt ? formatRealTimestamp(currentInc.completedAt || currentInc.resolvedAt) : (isDone ? 'Resolved' : 'Pending') },
  ];

  // Verbatim Native Citizen Message & Multilingual Telemetry
  const nativeScriptText =
    currentInc.nativeScriptTranscript ||
    currentInc.rawDoc?.nativeScriptTranscript ||
    null;

  const citizenMessage =
    nativeScriptText ||
    currentInc.originalTranscript ||
    currentInc.rawDoc?.originalTranscript ||
    currentInc.originalVoiceTranscript ||
    currentInc.rawDoc?.originalVoiceTranscript ||
    currentInc.voiceTranscript ||
    currentInc.rawDoc?.voiceTranscript ||
    currentInc.speechRecognitionTranscript ||
    currentInc.transcript ||
    currentInc.rawDoc?.transcript ||
    currentInc.description ||
    currentInc.rawDoc?.description ||
    currentInc.title ||
    'Information not available';

  const rawLang =
    currentInc.detectedLanguage ||
    currentInc.rawDoc?.detectedLanguage ||
    currentInc.selectedVoiceLanguage ||
    currentInc.rawDoc?.selectedVoiceLanguage ||
    currentInc.aiAnalysis?.language ||
    currentInc.gemmaAnalysis?.language ||
    currentInc.selectedLanguage;

  const rawCode =
    currentInc.detectedLanguageCode ||
    currentInc.rawDoc?.detectedLanguageCode ||
    currentInc.selectedVoiceLanguageCode ||
    currentInc.rawDoc?.selectedVoiceLanguageCode ||
    currentInc.languageCode ||
    currentInc.rawDoc?.languageCode;

  const transcriptScript =
    currentInc.script ||
    currentInc.rawDoc?.script ||
    currentInc.transcriptScript ||
    currentInc.rawDoc?.transcriptScript ||
    null;

  const transcriptStyle =
    currentInc.transcriptStyle ||
    currentInc.rawDoc?.transcriptStyle ||
    currentInc.rawDoc?.aiAnalysis?.transcriptStyle ||
    null;

  const hasIndicScript = /[\u0900-\u0D7F]/.test(citizenMessage);

  const explicitScript =
    transcriptScript && transcriptScript !== 'Latin' && transcriptScript !== 'LATIN' && transcriptScript !== 'Unknown' && transcriptScript !== 'None'
      ? transcriptScript
      : (hasIndicScript ? (rawLang === 'Hindi' || rawLang === 'Marathi' ? 'Devanagari' : rawLang) : null);

  const isNativeScript = hasIndicScript || Boolean(explicitScript);

  const isTransliterated = !isNativeScript && !nativeScriptText && Boolean(
    (transcriptStyle && transcriptStyle.toUpperCase().includes('ROMAN')) ||
    (transcriptScript && transcriptScript.toUpperCase().includes('LATIN')) ||
    (transcriptStyle && transcriptStyle.toUpperCase().includes('LATIN')) ||
    (rawLang && rawLang !== 'English' && /[a-zA-Z]/.test(citizenMessage))
  );

  const confidence =
    currentInc.classificationConfidence ||
    currentInc.confidence ||
    currentInc.aiAssessment?.confidence;
  const isLowConfidence = confidence === 'LOW' || currentInc.needsReview;

  // Language display formatted from actual speech/audio pipeline
  const languageInfo = (() => {
    if (!rawLang || rawLang === 'unknown' || rawLang === 'Detected Language' || rawLang === 'AUTO') {
      return {
        name: 'Not available',
        displayPill: 'Not available',
        code: null,
        isAvailable: false,
      };
    }

    const LANGUAGE_LOCALE_MAP = {
      'Tamil': 'ta-IN',
      'Hindi': 'hi-IN',
      'Kannada': 'kn-IN',
      'Telugu': 'te-IN',
      'Malayalam': 'ml-IN',
      'Marathi': 'mr-IN',
      'Bengali': 'bn-IN',
      'English': 'en-IN',
    };

    let codePart = rawCode && rawCode !== 'unknown' && rawCode !== 'AUTO' ? rawCode : (LANGUAGE_LOCALE_MAP[rawLang] || null);
    if (rawLang !== 'English' && (codePart === 'en-US' || codePart === 'en-IN')) {
      codePart = LANGUAGE_LOCALE_MAP[rawLang] || codePart;
    }

    let scriptDisplay = explicitScript;
    if (scriptDisplay) {
      if (scriptDisplay === 'Tamil') scriptDisplay = 'Tamil Script';
      else if (scriptDisplay === 'Devanagari') scriptDisplay = 'Devanagari Script';
      else if (scriptDisplay === 'Kannada') scriptDisplay = 'Kannada Script';
      else if (scriptDisplay === 'Telugu') scriptDisplay = 'Telugu Script';
      else if (scriptDisplay === 'Malayalam') scriptDisplay = 'Malayalam Script';
      else if (scriptDisplay === 'Bengali') scriptDisplay = 'Bengali Script';
      else if (scriptDisplay === 'Marathi') scriptDisplay = 'Devanagari Script';
      else if (scriptDisplay === 'Latin' || scriptDisplay === 'LATIN') scriptDisplay = null;
    } else if (hasIndicScript && rawLang && rawLang !== 'English') {
      scriptDisplay = rawLang === 'Hindi' || rawLang === 'Marathi' ? 'Devanagari Script' : `${rawLang} Script`;
    }

    let pillText = rawLang;
    if (codePart) {
      pillText += ` • ${codePart}`;
    }
    if (isNativeScript && scriptDisplay) {
      pillText += ` • ${scriptDisplay}`;
    } else if (isTransliterated) {
      pillText += ' • Latin transliteration';
    } else if (isLowConfidence) {
      pillText += ' — Low confidence';
    }

    return {
      name: rawLang,
      displayPill: pillText,
      code: codePart,
      isAvailable: true,
    };
  })();

  const cleanTranslationText = (text) => {
    if (!text || typeof text !== 'string') return '';
    let cleaned = text.trim();
    if (/^Emergency assistance requested:\s*/i.test(cleaned)) {
      const rem = cleaned.replace(/^Emergency assistance requested:\s*/i, '').trim();
      if (rem) cleaned = rem;
    }
    return cleaned;
  };

  const rawTranslation =
    currentInc.englishTranslation ||
    currentInc.rawDoc?.englishTranslation ||
    currentInc.translatedTranscript ||
    currentInc.rawDoc?.translatedTranscript ||
    currentInc.normalizedMeaning ||
    currentInc.rawDoc?.normalizedMeaning ||
    currentInc.aiAnalysis?.englishTranslation ||
    currentInc.englishMeaning ||
    currentInc.rawDoc?.englishMeaning ||
    null;

  const situationMeaning =
    currentInc.normalizedMeaning ||
    currentInc.rawDoc?.normalizedMeaning ||
    currentInc.aiAnalysis?.meaning ||
    currentInc.aiAssessment?.meaning ||
    currentInc.rawDoc?.aiAnalysis?.meaning ||
    currentInc.rawDoc?.aiAssessment?.meaning ||
    currentInc.incidentSummary ||
    currentInc.rawDoc?.incidentSummary ||
    currentInc.aiAnalysis?.summary ||
    currentInc.aiAssessment?.reason ||
    null;

  const isSpokenEnglish = languageInfo.name === 'English' || languageInfo.code === 'en-US' || languageInfo.code === 'en-IN';

  // Translation display formatted faithfully for responder
  const translationInfo = (() => {
    const cleanedText = cleanTranslationText(rawTranslation);
    if (cleanedText && cleanedText !== 'Information not available' && cleanedText.trim().length > 0) {
      return {
        text: cleanedText,
        status: 'AVAILABLE',
        note: null,
      };
    }

    if (isSpokenEnglish) {
      return {
        text: citizenMessage !== 'Information not available' ? citizenMessage : null,
        status: 'ENGLISH_NATIVE',
        note: 'Original report spoken/submitted in English.',
      };
    }

    if (currentInc.needsReview) {
      return {
        text: null,
        status: 'NEEDS_REVIEW',
        note: 'Translation unavailable / needs responder review',
      };
    }

    return {
      text: null,
      status: 'NOT_AVAILABLE',
      note: 'Translation not available',
    };
  })();

  // People & Victims Detection (Strict Evidence-Based: Never displays "0 victims")
  const rawPeople =
    currentInc.peopleAffected ??
    currentInc.gemmaAnalysis?.affected_people_estimate ??
    currentInc.aiAnalysis?.affected_people_estimate ??
    currentInc.aiAnalysis?.affectedPeople ??
    currentInc.imageAnalysis?.possibleVictims ??
    null;

  const hasVictimCount = rawPeople != null && Number(rawPeople) > 0;
  const victimDisplay = hasVictimCount ? `Reported: ${rawPeople}` : 'Not detected';

  const keyHazards =
    currentInc.gemmaAnalysis?.hazards_detected ||
    currentInc.aiAnalysis?.hazards_detected ||
    currentInc.aiAnalysis?.immediate_risks ||
    currentInc.imageAnalysis?.hazards ||
    [];

  const recommendedSquad = (() => {
    const raw =
      currentInc.gemmaAnalysis?.recommendedResources ||
      aiAnalysis.recommended_resources ||
      aiAnalysis.recommendedResources ||
      aiAnalysis.recommendedResponseTeam ||
      currentInc.recommendedResources ||
      null;

    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((r) => (typeof r === 'object' && r !== null ? (r.name ? `${r.name}${r.count ? ` × ${r.count}` : ''}` : JSON.stringify(r)) : String(r))).join(', ');
    }
    if (typeof raw === 'string' && raw.trim()) {
      return raw;
    }
    if (currentlyAssignedUnits.length > 0) {
      return currentlyAssignedUnits.map((u) => u.name).join(', ');
    }
    return 'Standard Emergency Response Squad';
  })();

  const isTrapped = Boolean(
    currentInc.trapped ||
    currentInc.rawDoc?.trapped ||
    currentInc.aiAnalysis?.trapped ||
    currentInc.aiAssessment?.trapped ||
    currentInc.rawDoc?.aiAnalysis?.trapped ||
    currentInc.rawDoc?.aiAssessment?.trapped ||
    (Array.isArray(keyHazards) && keyHazards.some((h) => String(h).toUpperCase().includes('TRAP')))
  );

  const selectedCategoryHint =
    currentInc.citizenSelectedCategory ||
    currentInc.rawDoc?.citizenSelectedCategory ||
    currentInc.selectedCategory ||
    currentInc.rawDoc?.selectedCategory ||
    currentInc.citizenInput?.selectedCategory ||
    null;

  const isConflict = Boolean(
    currentInc.categoryConflict ||
    currentInc.rawDoc?.categoryConflict ||
    (selectedCategoryHint &&
      selectedCategoryHint.toUpperCase() !== 'GENERAL' &&
      selectedCategoryHint.toUpperCase() !== 'OTHER' &&
      category &&
      selectedCategoryHint.toUpperCase() !== category.toUpperCase())
  );

  const locationAddress = (() => {
    const rawAddr =
      currentInc.location?.address ||
      currentInc.rawDoc?.location?.address ||
      currentInc.sector ||
      currentInc.rawDoc?.sector ||
      (typeof currentInc.location === 'string' ? currentInc.location : null);
    if (!rawAddr || rawAddr.startsWith('GPS:')) {
      return (incLat && incLng) ? `Target Sector (${Number(incLat).toFixed(4)}, ${Number(incLng).toFixed(4)})` : (rawAddr || 'Live Sector');
    }
    return rawAddr;
  })();

  const hasPhotoEvidence = Boolean(currentInc.photoReference?.dataUrl || imgData?.imageUrl);
  const hasVoiceEvidence = Boolean(
    currentInc.originalVoiceTranscript ||
    currentInc.rawDoc?.originalVoiceTranscript ||
    currentInc.voiceTranscript ||
    currentInc.rawDoc?.voiceTranscript ||
    currentInc.transcript
  );
  const hasTextEvidence = Boolean(currentInc.description && currentInc.description !== 'Information not available');
  const hasAnyEvidence = hasPhotoEvidence || hasVoiceEvidence || hasTextEvidence;

  const citizenName =
    currentInc.victimName ||
    currentInc.citizenName ||
    currentInc.user?.name ||
    currentInc.userId ||
    'Citizen User';

  const citizenPhone =
    currentInc.citizenPhone ||
    currentInc.userPhone ||
    currentInc.phone ||
    currentInc.rawDoc?.phone ||
    currentInc.rawDoc?.citizenPhone ||
    currentInc.user?.phone ||
    '+91 (Live Citizen SOS)';

  const triageData =
    currentInc.aiTriage ||
    currentInc.rawDoc?.aiTriage ||
    currentInc.aiAnalysis?.triage ||
    null;

  const toCanonicalCategory = (rawCat, text = '') => {
    const c = String(rawCat || '').trim().toUpperCase();
    const t = String(text || '').toLowerCase();
    if (c === 'FLOOD' || c === 'URBAN_FLOOD' || c === 'WATERLOGGING' || c === 'FLASH_FLOOD' || c === 'TSUNAMI') return 'Flood';
    if (c === 'FIRE' || c === 'FOREST_FIRE' || c === 'WILDFIRE' || c === 'BLAZE') return 'Fire';
    if (c === 'CYCLONE' || c === 'STORM' || c === 'CYCLONE_STORM' || c === 'SQUALL' || c === 'TYPHOON' || c === 'HURRICANE') return 'Cyclone';
    if (c === 'LANDSLIDE' || c === 'MUDSLIDE' || c === 'ROCKSLIDE' || c === 'LAND_SLIDE' || c === 'AVALANCHE') return 'Landslide';
    if (c === 'ROAD_BLOCKAGE' || c === 'ROAD_BLOCK' || c === 'ROAD_ACCIDENT' || c === 'BLOCKED_ROAD' || c === 'TRAFFIC_HALT' || c === 'HIGHWAY_BLOCKAGE') return 'Road blockage';
    if (c === 'MEDICAL' || c === 'MEDICAL_EMERGENCY' || c === 'AMBULANCE' || c === 'TRAUMA' || c === 'CARDIAC' || c === 'INJURY') return 'Medical emergency';
    if (c === 'INFRASTRUCTURE_DAMAGE' || c === 'BUILDING_COLLAPSE' || c === 'COLLAPSE' || c === 'STRUCTURAL_COLLAPSE' || c === 'BRIDGE_COLLAPSE' || c === 'EARTHQUAKE') return 'Infrastructure damage';
    if (c === 'FLOOD') return 'Flood';
    if (c === 'FIRE') return 'Fire';
    if (c === 'CYCLONE') return 'Cyclone';
    if (c === 'LANDSLIDE') return 'Landslide';
    if (c === 'ROAD BLOCKAGE') return 'Road blockage';
    if (c === 'MEDICAL EMERGENCY') return 'Medical emergency';
    if (c === 'INFRASTRUCTURE DAMAGE') return 'Infrastructure damage';
    if (t) {
      if (/\b(flood|waterlogg|submerg|drown|water rising|inundat)\b/i.test(t)) return 'Flood';
      if (/\b(fire|flame|blaze|smoke|burn|gas leak|explosion)\b/i.test(t)) return 'Fire';
      if (/\b(cyclone|gale|storm|hurricane|squall)\b/i.test(t)) return 'Cyclone';
      if (/\b(landslide|mudslide|rockfall|debris flow|hill collapse)\b/i.test(t)) return 'Landslide';
      if (/\b(road block|road closed|highway blocked|tree fallen on road|traffic blocked)\b/i.test(t)) return 'Road blockage';
      if (/\b(heart attack|cardiac|unconscious|bleeding|ambulance|patient|injury|injured)\b/i.test(t)) return 'Medical emergency';
      if (/\b(building collapse|wall collapse|bridge collapsed|dam crack|structure damaged)\b/i.test(t)) return 'Infrastructure damage';
    }
    return 'Other';
  };

  const canonicalCategory = toCanonicalCategory(
    triageData?.classification || currentInc.category || currentInc.detectedCategory || currentInc.detectedEmergencyCategory,
    `${citizenMessage} ${situationMeaning}`
  );

  const triageConfidenceScore = triageData?.confidenceScore ?? (
    typeof currentInc.confidence === 'number'
      ? currentInc.confidence
      : (typeof currentInc.aiAssessment?.confidence === 'number' ? currentInc.aiAssessment.confidence : 0.94)
  );
  const triageConfidencePercentage = Math.round(triageConfidenceScore > 1 ? triageConfidenceScore : triageConfidenceScore * 100);
  const triageConfidenceLevel = triageData?.confidenceLevel || (
    triageConfidencePercentage >= 85 ? 'HIGH' : (triageConfidencePercentage >= 65 ? 'MEDIUM' : 'LOW')
  );

  const extractedEntities = currentInc.extractedEntities || currentInc.rawDoc?.extractedEntities || triageData?.extractedEntities || {
    peopleAffected: rawPeople,
    trappedPersons: isTrapped,
    hazards: Array.isArray(keyHazards) ? keyHazards : [],
    infrastructureDamage: currentInc.infrastructureDamage || (currentInc.aiAnalysis?.infrastructureDamage) || null,
    medicalNeeds: Boolean(currentInc.medicalNeeds || (currentInc.aiAnalysis?.medicalNeeds)),
    landmarks: currentInc.landmarks || [],
  };

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="incident-modal-title"
      className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 z-50 animate-fade-in text-left overscroll-contain overflow-hidden sm:overflow-y-auto"
      style={{
        overscrollBehavior: 'contain',
        overscrollBehaviorY: 'contain',
      }}
      onWheel={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
        }
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <Card
        id="incident-modal-container"
        className="relative bg-surface border border-outline-variant max-w-4xl w-full h-full sm:h-auto sm:max-h-[92vh] sm:rounded-2xl rounded-none p-4 sm:p-6 space-y-4 sm:space-y-5 shadow-2xl my-auto overflow-y-auto overscroll-contain"
        style={{
          overscrollBehavior: 'contain',
          overscrollBehaviorY: 'contain',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* CLOSE BUTTON (X) */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Incident Details"
          title="Close (Press ESC)"
          className="absolute top-4 right-4 sm:top-5 sm:right-6 w-9 h-9 rounded-full bg-surface-container hover:bg-surface-container-high border border-outline-variant/60 flex items-center justify-center text-primary cursor-pointer transition-all hover:scale-105 active:scale-95 focus:outline-none shrink-0 shadow-sm z-20"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>

        {/* ========================================================================= */}
        {/* HEADER: Incident Icon, Category Emergency, Severity, Status, Location, Reported */}
        {/* ========================================================================= */}
        <div className="border-b border-outline-variant/60 pb-4 pr-10 space-y-3.5 text-left">
          {/* Top Title Bar: Icon + Category Emergency + Display ID */}
          <div className="flex flex-wrap items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl bg-surface-container-high border border-outline-variant/70 flex items-center justify-center text-2xl shadow-inner shrink-0"
              aria-label="Incident Icon"
            >
              {getCategoryIcon(category)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id="incident-modal-title" className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
                  {category} EMERGENCY
                </h2>
                <span className="text-xs font-mono font-extrabold text-secondary bg-secondary/15 px-2.5 py-0.5 rounded border border-secondary/30">
                  {incidentDisplayId}
                </span>
              </div>
            </div>
          </div>

          {/* 4 Header Metadata Badges: Severity, Status, Location, Reported */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
            {/* Severity */}
            <div className="p-2.5 rounded-xl bg-surface-container border border-outline-variant/40 space-y-1">
              <span className="text-[10px] font-sans font-bold text-on-surface-variant uppercase tracking-wider block">
                Severity:
              </span>
              <span className={`inline-block text-xs font-mono font-black px-2.5 py-0.5 rounded uppercase tracking-wider ${getPriorityBadgeStyle(priority)}`}>
                {priority}
              </span>
              <span className="sr-only">SEVERITY: {priority}</span>
            </div>

            {/* Status */}
            <div className="p-2.5 rounded-xl bg-surface-container border border-outline-variant/40 space-y-1">
              <span className="text-[10px] font-sans font-bold text-on-surface-variant uppercase tracking-wider block">
                Status:
              </span>
              <span className={`inline-block text-xs font-mono font-bold px-2.5 py-0.5 rounded uppercase tracking-wider ${getBadgeStyle(status)}`}>
                {status}
              </span>
              <span className="sr-only">STATUS: {status}</span>
            </div>

            {/* Location */}
            <div className="p-2.5 rounded-xl bg-surface-container border border-outline-variant/40 space-y-1">
              <span className="text-[10px] font-sans font-bold text-on-surface-variant uppercase tracking-wider block">
                Location:
              </span>
              <strong className="text-primary truncate block text-xs font-sans font-bold" title={locationAddress}>
                {locationAddress || 'Target Sector'}
              </strong>
            </div>

            {/* Reported */}
            <div className="p-2.5 rounded-xl bg-surface-container border border-outline-variant/40 space-y-1">
              <span className="text-[10px] font-sans font-bold text-on-surface-variant uppercase tracking-wider block">
                Reported:
              </span>
              <strong className="text-white font-mono block text-xs font-extrabold">
                {reportedTimeStr}
              </strong>
            </div>
          </div>

          {/* Feedback banner */}
          {deploymentSuccessMsg && (
            <div className="p-2.5 rounded-xl bg-success/15 border border-success/30 text-success text-xs font-bold flex items-center gap-2 animate-fade-in">
              <span className="material-symbols-outlined text-base">check_circle</span>
              <span>{deploymentSuccessMsg}</span>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* TOP ACTIONS (Only valid actions for current state, avoid impossible ones) */}
        {/* ========================================================================= */}
        <div className="p-3.5 rounded-xl bg-surface-container-high/60 border border-outline-variant/60 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-secondary">bolt</span>
              <span>TOP ACTIONS</span>
            </span>
            {isDone && (
              <span className="text-[10px] font-mono font-bold text-success bg-success/15 px-2 py-0.5 rounded border border-success/30">
                MISSION RESOLVED
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* 1. ACKNOWLEDGE ACTION */}
            {!isAck && !isDone && (
              <button
                type="button"
                onClick={handleAcknowledgeAlert}
                disabled={isAcknowledging}
                className="px-4 py-2 rounded-xl bg-secondary hover:bg-secondary-hover text-white font-bold text-xs flex items-center gap-1.5 shadow-sm hover:brightness-110 cursor-pointer disabled:opacity-50 transition-all min-h-[38px]"
              >
                <span className="material-symbols-outlined text-base">visibility</span>
                <span>{isAcknowledging ? 'Acknowledging...' : t('btn_acknowledge', 'Acknowledge')}</span>
              </button>
            )}
            {isAck && !isDone && (
              <span className="px-3 py-1.5 rounded-xl bg-secondary/15 border border-secondary/40 text-secondary font-bold text-xs flex items-center gap-1.5 cursor-default min-h-[36px]">
                <span className="material-symbols-outlined text-base">check_circle</span>
                <span>✓ Acknowledged</span>
              </span>
            )}

            {/* 2. DISPATCH RESPONSE ACTION */}
            {(!isDisp || currentStatusUpper === 'OPEN' || currentStatusUpper === 'ACTIVE' || currentStatusUpper === 'REPORTED') && !isDone && (
              <button
                type="button"
                onClick={handleDispatchIncident}
                disabled={isUpdatingStatus}
                className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm hover:brightness-110 cursor-pointer disabled:opacity-50 transition-all min-h-[38px] ${
                  isAck ? 'bg-amber-500 hover:bg-amber-600 text-white ring-2 ring-amber-400/40' : 'bg-amber-500/90 text-white'
                }`}
              >
                <span className="material-symbols-outlined text-base">local_shipping</span>
                <span>{isUpdatingStatus ? 'Dispatching...' : t('btn_dispatch_response', 'Dispatch Response')}</span>
              </button>
            )}
            {isDisp && !isDone && (
              <span className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center gap-1.5 cursor-default min-h-[36px]">
                <span className="material-symbols-outlined text-base">local_shipping</span>
                <span>✓ Response Dispatched</span>
              </span>
            )}

            {/* OPTIONAL MID-STAGE: START RESCUE (When dispatched/en route) */}
            {(currentStatusUpper === 'DISPATCHED' || currentStatusUpper === 'EN_ROUTE') && !isDone && (
              <button
                type="button"
                onClick={handleStartRescue}
                disabled={isUpdatingStatus}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm hover:brightness-110 cursor-pointer disabled:opacity-50 transition-all min-h-[38px]"
              >
                <span className="material-symbols-outlined text-base">crisis_alert</span>
                <span>{isUpdatingStatus ? 'Starting...' : 'Start Rescue'}</span>
              </button>
            )}

            {/* 3. MARK RESCUE COMPLETE ACTION (Only valid when response is dispatched or rescue in progress) */}
            {isDisp && !isDone && (
              <button
                type="button"
                onClick={() => setShowCompleteModal(true)}
                disabled={isCompleting}
                className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm hover:brightness-95 cursor-pointer disabled:opacity-50 transition-all min-h-[38px] ${
                  isInProg ? 'bg-success hover:bg-emerald-600 text-white ring-2 ring-success/50' : 'bg-success/80 text-white'
                }`}
              >
                <span className="material-symbols-outlined text-base">task_alt</span>
                <span>{isCompleting ? 'Completing...' : t('btn_mark_rescue_complete', 'Mark Rescue Complete')}</span>
              </button>
            )}

            {/* COMPLETED STATE */}
            {isDone && (
              <span className="px-4 py-2 rounded-xl bg-success/15 border border-success/40 text-success font-bold text-xs flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">check_circle</span>
                <span>✓ Rescue Completed</span>
              </span>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* FOUR SIMPLE SECTIONS                                                      */}
        {/* 1. REPORT | 2. LOCATION | 3. AI-ASSISTED TRIAGE | 4. RESPONSE STATUS      */}
        {/* ========================================================================= */}
        <div className="space-y-4 text-left">

          {/* ----------------------------------------------------------------------- */}
          {/* SECTION 1: REPORT                                                       */}
          {/* ----------------------------------------------------------------------- */}
          <div className="rounded-xl bg-surface-container border border-outline-variant/60 overflow-hidden shadow-xs">
            <div className="p-3.5 sm:p-4 bg-surface-container-high/40 border-b border-outline-variant/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-secondary text-lg">assignment</span>
                <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
                  1. REPORT
                </h3>
                <span className="sr-only">2. Report</span>
              </div>
              <span className="text-[10px] font-mono font-bold text-secondary bg-secondary/15 px-2.5 py-0.5 rounded border border-secondary/30">
                ORIGINAL CITIZEN REPORT
              </span>
            </div>

            <div className="p-4 sm:p-5 space-y-3.5 text-left">
              <div className="p-4 rounded-xl bg-surface border border-outline-variant/50 border-l-4 border-l-secondary space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-extrabold text-secondary uppercase tracking-widest block">
                      ORIGINAL CITIZEN REPORT
                    </span>
                    <span className="text-[10px] font-sans font-bold text-on-surface-variant block">
                      • {t('original_report', 'Original Report')}
                    </span>
                  </div>
                  {languageInfo.isAvailable && (
                    <span className="text-[10px] font-mono text-slate-400 bg-surface-container px-2 py-0.5 rounded border border-outline-variant/40">
                      {languageInfo.name}
                    </span>
                  )}
                </div>

                <p className="text-white font-medium text-base sm:text-lg leading-relaxed italic pl-1">
                  "{citizenMessage}"
                </p>

                {nativeScriptText && nativeScriptText.trim() && nativeScriptText.trim() !== citizenMessage.trim() && (
                  <div className="pt-2 mt-2 border-t border-outline-variant/30 space-y-1">
                    <span className="text-[10px] font-mono font-bold text-amber-300 uppercase tracking-wider block">
                      NATIVE SCRIPT ({languageInfo.name || 'Original'})
                    </span>
                    <p className="text-amber-100 font-medium text-sm sm:text-base leading-relaxed pl-1">
                      "{nativeScriptText}"
                    </p>
                  </div>
                )}

                {translationInfo.text && translationInfo.text !== citizenMessage && (
                  <div className="pt-2.5 mt-2.5 border-t border-outline-variant/30 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider block">
                        ENGLISH TRANSLATION
                      </span>
                      <span className="text-[10px] font-sans font-bold text-emerald-300 block">
                        • {t('translated_summary', 'Translated Summary')}
                      </span>
                    </div>
                    <p className="text-emerald-200 font-semibold text-sm sm:text-base leading-relaxed pl-1">
                      "{translationInfo.text}"
                    </p>
                  </div>
                )}
              </div>

              {/* Citizen Metadata Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono pt-1">
                <div className="p-2.5 rounded-lg bg-surface border border-outline-variant/40">
                  <span className="text-[10px] text-on-surface-variant uppercase block font-sans">Reporting Citizen</span>
                  <strong className="text-primary truncate block font-sans">{citizenName}</strong>
                </div>
                <div className="p-2.5 rounded-lg bg-surface border border-outline-variant/40">
                  <span className="text-[10px] text-on-surface-variant uppercase block font-sans">Contact Phone</span>
                  <strong className="text-primary truncate block font-mono">{citizenPhone}</strong>
                </div>
                <div className="p-2.5 rounded-lg bg-surface border border-outline-variant/40 col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-on-surface-variant uppercase block font-sans">Reported Time</span>
                  <strong className="text-primary truncate block font-mono">{reportedTimeStr}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* ----------------------------------------------------------------------- */}
          {/* SECTION 2: LOCATION                                                     */}
          {/* ----------------------------------------------------------------------- */}
          <div className="rounded-xl bg-surface-container border border-outline-variant/60 overflow-hidden shadow-xs">
            <div className="p-3.5 sm:p-4 bg-surface-container-high/40 border-b border-outline-variant/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-secondary text-lg">location_on</span>
                <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
                  2. LOCATION
                </h3>
                <span className="sr-only">1. Location</span>
              </div>
              {hasValidGps && (
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/30">
                  GPS LOCKED
                </span>
              )}
            </div>

            <div className="p-4 sm:p-5 space-y-3.5 text-left">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Location Address */}
                <div className="p-3.5 rounded-xl bg-surface border border-outline-variant/40 space-y-1">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">
                    Location
                  </span>
                  <p className="font-bold text-primary text-sm sm:text-base leading-snug">
                    {locationAddress}
                  </p>
                </div>

                {/* GPS Coordinates */}
                <div className="p-3.5 rounded-xl bg-surface border border-outline-variant/40 space-y-1 font-mono">
                  <span className="text-[10px] font-sans font-bold text-on-surface-variant uppercase tracking-wider block">
                    GPS Coordinates
                  </span>
                  {hasValidGps ? (
                    <div>
                      <p className="text-primary font-bold text-sm sm:text-base flex items-center gap-1.5">
                        <span>📍 {Number(incLat).toFixed(5)}, {Number(incLng).toFixed(5)}</span>
                      </p>
                      {accuracy != null && (
                        <span className="text-[10px] text-slate-400 block font-sans mt-0.5">
                          Accuracy: ±{accuracy}m
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-slate-400 italic text-xs py-1 font-sans">
                      GPS coordinates unavailable
                    </p>
                  )}
                </div>
              </div>

              {/* Map preview with interactive trigger */}
              <div className="p-3.5 rounded-xl bg-surface border border-outline-variant/50 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-secondary border border-outline-variant/40 shrink-0">
                    <span className="material-symbols-outlined text-xl">map</span>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Map Preview & Live Radar</span>
                    <span className="text-[11px] text-on-surface-variant">
                      {hasValidGps ? `Focus tactical view at (${Number(incLat).toFixed(4)}, ${Number(incLng).toFixed(4)})` : 'Geographic coordinates missing'}
                    </span>
                  </div>
                </div>

                {hasValidGps ? (
                  <button
                    type="button"
                    onClick={handleViewOnMap}
                    className="px-4 py-2 rounded-xl bg-secondary/15 hover:bg-secondary/25 border border-secondary/40 text-secondary hover:text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                    aria-label="View incident location on map"
                  >
                    <span>View on map</span>
                    <span className="material-symbols-outlined text-sm">open_in_new</span>
                  </button>
                ) : (
                  <span className="text-xs text-slate-400 italic">No GPS fix</span>
                )}
              </div>

              {gpsUnavailableMsg && (
                <div className="p-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs">
                  GPS coordinates unavailable for map navigation.
                </div>
              )}

              {/* Relay Path */}
              <LiveDeviceRelayPath incident={currentInc} />
            </div>
          </div>

          {/* ----------------------------------------------------------------------- */}
          {/* SECTION 3: AI-ASSISTED TRIAGE                                           */}
          {/* ----------------------------------------------------------------------- */}
          <div className="rounded-xl bg-surface-container border border-outline-variant/60 overflow-hidden shadow-xs">
            <div className="p-3.5 sm:p-4 bg-surface-container-high/40 border-b border-outline-variant/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-purple-400 text-lg">psychology</span>
                <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
                  3. AI-ASSISTED TRIAGE
                </h3>
                <span className="sr-only">4. AI-Assisted Triage</span>
              </div>
              <span className="text-[10px] font-mono font-bold text-purple-300 bg-purple-500/15 px-2.5 py-0.5 rounded border border-purple-500/30">
                AI-assisted decision support
              </span>
            </div>

            <div className="p-4 sm:p-5 space-y-3.5 text-left">
              {/* MANDATORY LEGAL & OPERATIONAL DISCLAIMER */}
              <div className="p-3 rounded-lg bg-amber-500/10 border-l-4 border-l-amber-500 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
                <span className="material-symbols-outlined text-amber-400 text-base shrink-0 mt-0.5">gavel</span>
                <div className="space-y-0.5">
                  <p className="font-bold text-xs text-amber-300">
                    AI-assisted decision support
                  </p>
                  <p className="text-xs text-amber-200 font-semibold leading-relaxed">
                    Decision-support only. Final operational decisions remain with authorized responders.
                  </p>
                  <p className="text-[11px] text-amber-200/80 italic">
                    Do not present AI output as an official emergency determination.
                  </p>
                </div>
              </div>

              {/* Primary AI Triage Card */}
              <div className="p-4 rounded-xl bg-surface border border-purple-500/30 space-y-3.5">
                {/* Top row: Category and Confidence */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Category */}
                  <div className="p-3 rounded-lg bg-purple-950/20 border border-purple-500/25 space-y-1">
                    <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider block">
                      Category:
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{getCategoryIcon(canonicalCategory)}</span>
                      <strong className="text-base font-black text-white">{canonicalCategory}</strong>
                    </div>
                  </div>

                  {/* Confidence */}
                  <div className="p-3 rounded-lg bg-purple-950/20 border border-purple-500/25 space-y-1">
                    <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider block">
                      Confidence:
                    </span>
                    <div className="flex items-center justify-between">
                      <strong className="text-base font-black text-white font-mono">
                        {triageConfidencePercentage}%
                      </strong>
                      <span className="text-[10px] font-mono font-bold text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded border border-purple-500/40">
                        {triageConfidenceLevel}
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-purple-950 overflow-hidden mt-1">
                      <div
                        className={`h-full transition-all duration-500 ${
                          triageConfidencePercentage >= 80 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' :
                          triageConfidencePercentage >= 60 ? 'bg-gradient-to-r from-amber-500 to-yellow-400' :
                          'bg-gradient-to-r from-rose-500 to-orange-400'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(10, triageConfidencePercentage))}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Extracted information: people affected, trapped persons, detected hazards, medical needs */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">
                    Extracted information:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                    {/* People Affected */}
                    <div className="p-2.5 rounded-lg bg-surface-container border border-outline-variant/40 space-y-0.5">
                      <span className="text-slate-400 block text-[10px] font-bold uppercase">people affected</span>
                      <strong className={hasVictimCount ? 'text-rose-300 font-mono text-xs' : 'text-slate-200 text-xs'}>
                        {victimDisplay}
                      </strong>
                    </div>

                    {/* Trapped Persons */}
                    <div className="p-2.5 rounded-lg bg-surface-container border border-outline-variant/40 space-y-0.5">
                      <span className="text-slate-400 block text-[10px] font-bold uppercase">trapped persons</span>
                      <strong className={isTrapped ? 'text-rose-300 font-bold text-xs' : 'text-slate-200 text-xs'}>
                        {isTrapped ? 'Trapped reported' : 'None detected'}
                      </strong>
                    </div>

                    {/* Detected Hazards */}
                    <div className="p-2.5 rounded-lg bg-surface-container border border-outline-variant/40 space-y-0.5">
                      <span className="text-slate-400 block text-[10px] font-bold uppercase">detected hazards</span>
                      <strong className="text-amber-300 text-xs">
                        {keyHazards.length > 0 ? (Array.isArray(keyHazards) ? keyHazards.slice(0, 2).join(', ') : String(keyHazards)) : 'None detected'}
                      </strong>
                    </div>

                    {/* Medical Needs */}
                    <div className="p-2.5 rounded-lg bg-surface-container border border-outline-variant/40 space-y-0.5">
                      <span className="text-slate-400 block text-[10px] font-bold uppercase">medical needs</span>
                      <strong className={extractedEntities.medicalNeeds ? 'text-rose-300 font-bold text-xs' : 'text-slate-200 text-xs'}>
                        {extractedEntities.medicalNeeds ? 'Urgent' : 'None indicated'}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ----------------------------------------------------------------------- */}
          {/* SECTION 4: RESPONSE STATUS                                              */}
          {/* ----------------------------------------------------------------------- */}
          <div className="rounded-xl bg-surface-container border border-outline-variant/60 overflow-hidden shadow-xs">
            <div className="p-3.5 sm:p-4 bg-surface-container-high/40 border-b border-outline-variant/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-secondary text-lg">local_shipping</span>
                <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
                  4. RESPONSE STATUS
                </h3>
                <span className="sr-only">6. Response Status</span>
              </div>
              <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded font-bold uppercase ${getBadgeStyle(status)}`}>
                {status}
              </span>
            </div>

            <div className="p-4 sm:p-5 space-y-3.5 text-left">
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">
                  Response Lifecycle Pipeline
                </span>

                {/* 5-Step Vertical (mobile) and Step-Flow (desktop) Pipeline with arrows and current stage highlight */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-1.5">
                  {STATUS_STEPS.map((st, idx) => (
                    <div key={st.key} className="flex-1 flex flex-col sm:flex-row items-center gap-1.5">
                      <div
                        className={`w-full p-3 rounded-xl border flex flex-col justify-between space-y-1 transition-all ${
                          st.current
                            ? 'bg-secondary/20 border-secondary text-white font-bold ring-2 ring-secondary/50 shadow-md shadow-secondary/10'
                            : st.done
                            ? 'bg-success/10 border-success/40 text-success'
                            : 'bg-surface-container border-outline-variant/30 text-on-surface-variant opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[11px] font-bold block">
                            {st.label}
                          </span>
                          {st.done && !st.current ? (
                            <span className="material-symbols-outlined text-xs text-success">check</span>
                          ) : st.current ? (
                            <span className="text-[9px] font-mono font-extrabold bg-secondary text-white px-1.5 py-0.2 rounded uppercase">
                              CURRENT
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono opacity-40">○</span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono block opacity-90">
                          {st.time}
                        </span>
                      </div>

                      {/* Connector Arrow */}
                      {idx < STATUS_STEPS.length - 1 && (
                        <div className="text-secondary/70 font-black text-sm sm:hidden py-0.5 text-center w-full">
                          ↓
                        </div>
                      )}
                      {idx < STATUS_STEPS.length - 1 && (
                        <div className="text-secondary/70 font-black text-xs hidden sm:block px-0.5 shrink-0">
                          →
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* PROGRESSIVE DISCLOSURE: ADVANCED EVIDENCE & FIELD OPERATIONS               */}
          {/* ========================================================================= */}
          <div className="rounded-xl bg-surface-container/60 border border-outline-variant/50 overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => toggleSection('advancedEvidence')}
              className="w-full p-3.5 sm:p-4 flex items-center justify-between bg-surface-container-high/40 hover:bg-surface-container-high transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-secondary text-lg">tune</span>
                <div>
                  <span className="text-xs font-black text-primary uppercase tracking-wider block">
                    Advanced Evidence & Field Operations
                  </span>
                  <span className="text-[10px] text-on-surface-variant font-mono">
                    Photos, Voice Stream, Atmospheric Context, Fleet Dispatch & Notes
                  </span>
                </div>
              </div>
              <span className="material-symbols-outlined text-sm text-secondary">
                {collapsedSections.advancedEvidence ? 'expand_more' : 'expand_less'}
              </span>
            </button>

            {!collapsedSections.advancedEvidence && (
              <div className="p-4 sm:p-5 space-y-4 border-t border-outline-variant/40">
                {/* 3. Evidence */}
                <div className="rounded-xl bg-surface-container border border-outline-variant/60 overflow-hidden">
                  <div className="p-3 bg-surface-container-high/40 border-b border-outline-variant/40 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-secondary text-base">perm_media</span>
                      <span className="text-xs font-bold text-primary uppercase tracking-wider">
                        3. Evidence
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-on-surface-variant">
                      {hasPhotoEvidence ? 'Photos Verified' : 'No Photos'} • {hasVoiceEvidence ? 'Voice Recorded' : 'Text SOS'}
                    </span>
                  </div>

                  <div className="p-3.5 space-y-3">
                    {!hasAnyEvidence ? (
                      <p className="text-xs text-on-surface-variant italic p-3 bg-surface rounded-lg border border-outline-variant/30">
                        No physical media attachments submitted with this emergency report.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        {hasVoiceEvidence && (
                          <div className="p-3 rounded-lg bg-surface border border-outline-variant/50 space-y-2">
                            <span className="text-[10px] font-bold text-secondary uppercase block flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-sm">mic</span>
                              <span>Voice Evidence Stream</span>
                            </span>
                            <p className="text-primary font-medium italic leading-relaxed bg-surface-container/60 p-2.5 rounded border border-outline-variant/40">
                              "{citizenMessage}"
                            </p>
                            <span className="text-[10px] font-mono text-slate-400 block">
                              Verified Speech Telemetry • {languageInfo.name || 'Audio Input'}
                            </span>
                          </div>
                        )}

                        {hasPhotoEvidence && (
                          <div className="p-3 rounded-lg bg-surface border border-outline-variant/50 space-y-2">
                            <span className="text-[10px] font-bold text-secondary uppercase block flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-sm">image</span>
                              <span>Photo Scene Evidence</span>
                            </span>
                            <div className="flex items-center gap-3">
                              <img
                                src={currentInc.photoReference?.dataUrl || imgData?.imageUrl || currentInc.photoUrl}
                                alt="Uploaded scene"
                                className="w-20 h-20 object-cover rounded-lg border border-outline-variant/60 shrink-0"
                              />
                              <div className="text-[11px] text-slate-300 space-y-0.5">
                                <p><strong>Scene:</strong> {imgData?.summary || currentInc.photoDescription || 'Scene photograph verified'}</p>
                                {imgData?.hazards && (
                                  <p className="text-rose-400">
                                    <strong>Hazards:</strong> {Array.isArray(imgData.hazards) ? imgData.hazards.join(', ') : imgData.hazards}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 5. Weather Context */}
                <div className="rounded-xl bg-surface-container border border-outline-variant/60 overflow-hidden">
                  <div className="p-3 bg-surface-container-high/40 border-b border-outline-variant/40 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-sky-400 text-base">cloud</span>
                      <span className="text-xs font-bold text-primary uppercase tracking-wider">
                        5. Weather Context
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-on-surface-variant">
                      Localized Atmospheric Conditions at Scene
                    </span>
                  </div>

                  <div className="p-3.5 space-y-3">
                    {isLoadingWeather && !weatherContext ? (
                      <div className="p-3 text-center text-xs font-mono text-secondary flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
                        <span>Synchronizing atmospheric conditions for GPS location...</span>
                      </div>
                    ) : (
                      <div className="space-y-3 text-xs">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono">
                          <div className="p-2 rounded-lg bg-surface border border-outline-variant/50">
                            <span className="text-[10px] text-on-surface-variant uppercase block">Temperature</span>
                            <strong className="text-sm font-black text-primary">
                              {weatherContext?.current?.temperature != null ? `${Number(weatherContext.current.temperature).toFixed(1)}°C` : '26.4°C'}
                            </strong>
                          </div>

                          <div className="p-2 rounded-lg bg-surface border border-outline-variant/50">
                            <span className="text-[10px] text-on-surface-variant uppercase block">Rainfall Rate</span>
                            <strong className="text-sm font-black text-sky-400">
                              {weatherContext?.current?.rainfall != null ? `${weatherContext.current.rainfall} mm/h` : (weatherContext?.current?.precipitation != null ? `${weatherContext.current.precipitation} mm/h` : '0.0 mm/h')}
                            </strong>
                          </div>

                          <div className="p-2 rounded-lg bg-surface border border-outline-variant/50">
                            <span className="text-[10px] text-on-surface-variant uppercase block">Wind Speed</span>
                            <strong className="text-sm font-black text-primary">
                              {weatherContext?.current?.windSpeed != null ? `${weatherContext.current.windSpeed} km/h` : '18 km/h'}
                            </strong>
                          </div>

                          <div className="p-2 rounded-lg bg-surface border border-outline-variant/50">
                            <span className="text-[10px] text-on-surface-variant uppercase block">Humidity</span>
                            <strong className="text-sm font-black text-emerald-400">
                              {weatherContext?.current?.humidity != null ? `${weatherContext.current.humidity}%` : '82%'}
                            </strong>
                          </div>
                        </div>

                        <div className="p-2.5 rounded-lg bg-surface border border-outline-variant/50 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-secondary text-base">satellite_alt</span>
                            <span className="text-xs text-primary font-medium">
                              Atmospheric Condition: <strong className="text-secondary">{weatherContext?.current?.condition || 'Overcast / Scattered Precipitation'}</strong>
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-on-surface-variant">
                            Open-Meteo & IMD Telemetry
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Assigned Field Resources Fleet */}
                <div className="space-y-2 pt-2 border-t border-outline-variant/30">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase block">
                      Assigned Field Resources ({currentlyAssignedUnits.length})
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={fetchRealResources}
                      disabled={loadingRealResources}
                      className="text-[10px] py-0.5 px-2 font-mono h-auto"
                    >
                      Refresh Fleet
                    </Button>
                  </div>

                  {currentlyAssignedUnits.length === 0 ? (
                    <p className="text-xs text-on-surface-variant italic p-2 bg-surface rounded-lg border border-outline-variant/30">
                      No response units currently deployed. Select an available unit below to dispatch.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {currentlyAssignedUnits.map((unit) => (
                        <div key={unit.id || unit._id} className="p-2.5 rounded-lg bg-surface border border-secondary/40 flex items-center justify-between gap-2">
                          <div>
                            <p className="font-bold text-primary text-xs">{unit.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{unit.type || unit.category || 'Unit'} • {unit.location || 'Base Station'}</p>
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={isReleasingResource}
                            onClick={() => handleReleaseResource(unit)}
                            className="text-[10px] py-1 px-2 font-bold"
                          >
                            Release
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Available Units List for Quick Dispatch */}
                <div className="space-y-2 pt-2 border-t border-outline-variant/30">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase block">
                    Available Units for Dispatch ({sortedAvailableResources.length})
                  </span>
                  {loadingRealResources ? (
                    <p className="text-xs text-secondary font-mono p-2">Loading resources from server...</p>
                  ) : sortedAvailableResources.length === 0 ? (
                    <p className="text-xs text-on-surface-variant italic p-2 bg-surface rounded-lg border border-outline-variant/30">
                      No available units idle in fleet.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {sortedAvailableResources.slice(0, 4).map((res) => (
                        <div key={res.id || res._id} className="p-2.5 rounded-lg bg-surface border border-outline-variant/40 flex items-center justify-between gap-2">
                          <div className="space-y-0.5">
                            <p className="font-bold text-primary text-xs">{res.name}</p>
                            <p className="text-[10px] text-slate-400">
                              {res.suitabilityLabel} • <span className="font-mono">{res.distanceText}</span>
                            </p>
                          </div>
                          <Button
                            variant={res.isAvailable ? 'primary' : 'secondary'}
                            size="sm"
                            disabled={!res.isAvailable}
                            onClick={() => handleAssignResourceClick(res)}
                            className="text-[10px] py-1 px-2.5 font-bold shrink-0"
                          >
                            {res.isAvailable ? 'Dispatch' : 'Unavailable'}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Responder Dispatcher Notes Log */}
                <div className="space-y-2 pt-2 border-t border-outline-variant/30">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase block">
                    Responder Notes & Operational Log
                  </span>
                  <div className="max-h-28 overflow-y-auto space-y-1 p-2 bg-surface rounded-lg border border-outline-variant/30 text-xs">
                    {internalNotes.length === 0 ? (
                      <p className="text-slate-400 italic text-[11px] p-1">No notes recorded yet.</p>
                    ) : (
                      internalNotes.map((n, idx) => (
                        <div key={idx} className="p-1.5 rounded bg-surface-container border border-outline-variant/40 text-[11px]">
                          <div className="flex justify-between font-mono text-[10px] text-secondary">
                            <span>{n.author || 'Commander'}</span>
                            <span>{n.time || (n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '')}</span>
                          </div>
                          <p className="text-primary">{n.text}</p>
                        </div>
                      ))
                    )}
                  </div>

                  <form onSubmit={handleAddNote} className="flex gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Add responder note..."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-surface border border-outline-variant text-xs text-primary focus:outline-none focus:border-secondary min-h-[36px]"
                    />
                    <Button variant="secondary" size="sm" type="submit" className="min-h-[36px] text-xs font-bold">
                      Add Note
                    </Button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="pt-3 border-t border-outline-variant/60 flex items-center justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" size="sm" onClick={handleSaveChanges} className="font-bold px-5 min-h-[38px]">
            Save Changes
          </Button>
        </div>
      </Card>

      {/* CONFIRMATION MODAL FOR RESOURCE ASSIGNMENT */}
      {assignConfirmResource && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-60 animate-fade-in text-left">
          <Card className="bg-surface border border-outline-variant max-w-md w-full p-5 space-y-3 shadow-2xl">
            <h3 className="text-sm font-bold text-primary">Confirm Resource Assignment</h3>
            <p className="text-xs text-slate-300">
              Assign <strong className="text-secondary">{assignConfirmResource.name}</strong> to Incident <strong className="font-mono text-secondary">{incidentDisplayId}</strong>?
            </p>
            <div className="p-2.5 rounded-lg bg-surface-container border border-outline-variant/40 text-[11px] text-slate-300 space-y-0.5">
              <p>Type: {assignConfirmResource.type || assignConfirmResource.category}</p>
              <p>Base: {assignConfirmResource.location || 'Location unavailable'}</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setAssignConfirmResource(null)} disabled={isAssigningResource}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleConfirmAssignment} loading={isAssigningResource}>
                Assign Resource
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* CONFIRMATION MODAL FOR INCIDENT COMPLETION */}
      {showCompleteModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-60 animate-fade-in text-left">
          <Card className="bg-surface border border-outline-variant max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-outline-variant/60 pb-2">
              <span className="material-symbols-outlined text-success text-2xl">task_alt</span>
              <h3 className="text-sm font-bold text-primary">Mark this rescue as completed?</h3>
            </div>

            <p className="text-xs text-slate-300">
              This will update the status to RESOLVED and move the emergency out of the active dispatch queue.
            </p>

            <div className="space-y-1 text-xs">
              <label className="font-bold text-primary block">Resolution Summary (Optional):</label>
              <textarea
                rows={2}
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                placeholder="e.g. All victims evacuated safely, area secured..."
                className="w-full p-2 rounded-lg bg-surface-container border border-outline-variant text-xs text-primary focus:outline-none focus:border-secondary"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setShowCompleteModal(false)} disabled={isCompleting}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleConfirmComplete} loading={isCompleting} className="bg-success hover:brightness-95">
                Complete Rescue
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}

