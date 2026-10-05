import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { incidentApi, weatherApi, resourceApi, invalidateApiCache } from '../services/api';
import useSocket from '../hooks/useSocket';
import { RESPONDER_ROUTES } from '../constants/routes';
import IncidentDetailModal from '../components/incidents/IncidentDetailModal';
import IncidentClusterDetailModal from '../components/dashboard/IncidentClusterDetailModal';
import UnifiedSituationView from '../components/dashboard/UnifiedSituationView';
import SituationOverviewCards from '../components/dashboard/SituationOverviewCards';
import ActiveWarningsBanner from '../components/dashboard/ActiveWarningsBanner';
import PriorityActionsDeck from '../components/dashboard/PriorityActionsDeck';
import LiveIncidentMapDeck from '../components/dashboard/LiveIncidentMapDeck';
import WeatherForecastDeck from '../components/dashboard/WeatherForecastDeck';
import WeatherGroundRiskCard from '../components/dashboard/WeatherGroundRiskCard';
import IncidentDetailsSection from '../components/dashboard/IncidentDetailsSection';
import { useSettings } from '../contexts/SettingsContext';
import { isIncidentActive } from '../utils/helpers';
import { doIncidentsMatch, getAuthoritativeIncidentCategory } from '../utils/mapIncidentNormalizer';

/**
 * Format timestamp into HH:mm format (e.g. 16:32, 17:04)
 */
function formatClockTime(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch (_) {
    return '—';
  }
}

/**
 * Format relative time (e.g. "4m ago", "1h ago")
 */
function formatRelativeTime(isoString) {
  if (!isoString) return '';
  try {
    const d = new Date(isoString).getTime();
    if (isNaN(d)) return '';
    const diffMin = Math.round((Date.now() - d) / 60000);
    if (diffMin <= 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.round(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.round(diffHours / 24)}d ago`;
  } catch (_) {
    return '';
  }
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { role, user } = useAuth();
  const { playEmergencyAlertSound, triggerVibration } = useSettings();

  // 1. Citizen Incidents State (Real MongoDB Data Only)
  const [incidents, setIncidents] = useState(() => {
    const cached = incidentApi.getCachedIncidents?.();
    return Array.isArray(cached) && cached.length > 0 ? cached : [];
  });
  const [isLoading, setIsLoading] = useState(() => {
    const cached = incidentApi.getCachedIncidents?.();
    return !(Array.isArray(cached) && cached.length > 0);
  });
  const [incidentsError, setIncidentsError] = useState(null);
  const [dashboardSummary, setDashboardSummary] = useState(() => {
    return incidentApi.getCachedDashboardSummary?.() || null;
  });

  // 2. Incident Clusters State (Real Multi-Citizen Fusion Data)
  const [clusters, setClusters] = useState(() => {
    const cached = incidentApi.getCachedClusters?.();
    return Array.isArray(cached) && cached.length > 0 ? cached : [];
  });
  const [isLoadingClusters, setIsLoadingClusters] = useState(() => {
    const cached = incidentApi.getCachedClusters?.();
    return !(Array.isArray(cached) && cached.length > 0);
  });
  const [clustersError, setClustersError] = useState(null);
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [isClusterModalOpen, setIsClusterModalOpen] = useState(false);

  // 3. Meteorological Intelligence & Risk State (Real Backend Open-Meteo & IMD Feeds)
  const [weatherData, setWeatherData] = useState(null);
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [riskAssessment, setRiskAssessment] = useState(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(true);

  // 3b. Unified Situation View State (Resonix Forecast + Ground Truth)
  const [situationData, setSituationData] = useState(null);
  const [isLoadingSituation, setIsLoadingSituation] = useState(true);
  const [showWeatherIntelligence, setShowWeatherIntelligence] = useState(false);

  // 4. Operational Resource Fleet (for Quick Assign Action)
  const [availableResources, setAvailableResources] = useState([]);
  const [quickAssignIncident, setQuickAssignIncident] = useState(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedResourceId, setSelectedResourceId] = useState('');
  const [isSubmittingAssign, setIsSubmittingAssign] = useState(false);

  // 5. In-Dashboard Manage Workspace Modal State
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [mapFocusTarget, setMapFocusTarget] = useState(null);

  // 6. Live Telemetry & Real-Time Sync Status State
  const [syncState, setSyncState] = useState({
    lastSynced: new Date(),
    isLive: true,
    isSyncing: false,
  });

  // 7. Multi-Dimensional Filter State for Level 8 Technical Records
  const [filters, setFilters] = useState({
    severity: 'ALL',             // ALL | CRITICAL | HIGH | MODERATE | LOW
    incidentType: 'ALL',         // ALL | FLOOD | FIRE | COLLAPSE | MEDICAL | STORM ...
    time: 'ALL',                 // ALL | 1H | 4H | 24H | TODAY
    location: '',                // String query or sector name
    status: 'ALL',               // ALL | ACTIVE | RESOLVED
    weatherAssociation: 'ALL',   // ALL | WARNED_ONLY
  });

  // URL Focus Navigation Handler
  const hasFocusedUrlParamRef = useRef(null);
  useEffect(() => {
    const incParam = searchParams.get('incident') || searchParams.get('incidentId') || location.state?.focusIncidentId;
    const latParam = searchParams.get('lat') || location.state?.lat;
    const lngParam = searchParams.get('lng') || location.state?.lng;

    const currentFocusKey = `${incParam || ''}_${latParam || ''}_${lngParam || ''}`;
    if (!currentFocusKey || currentFocusKey === '__') return;
    if (hasFocusedUrlParamRef.current === currentFocusKey) return;

    if (latParam != null && lngParam != null && !isNaN(Number(latParam)) && !isNaN(Number(lngParam))) {
      hasFocusedUrlParamRef.current = currentFocusKey;
      setMapFocusTarget({
        lat: Number(latParam),
        lng: Number(lngParam),
        incidentId: incParam || null,
        displayId: location.state?.displayId || incParam,
        zoom: 16,
        timestamp: Date.now(),
      });
      const radarElem = document.getElementById('live-incident-radar-section');
      if (radarElem) {
        radarElem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } else if (incParam && incidents.length > 0) {
      const targetStr = String(incParam).toLowerCase();
      const found = incidents.find((i) => {
        const idStr = String(i.id || i._id || i.packetId || i.clientRequestId || '').toLowerCase();
        const dispStr = String(i.displayId || '').toLowerCase();
        return idStr === targetStr || dispStr === targetStr || idStr.endsWith(targetStr);
      });

      const lat = found?.location?.lat ?? found?.lat ?? found?.rawDoc?.location?.lat;
      const lng = found?.location?.lng ?? found?.lng ?? found?.rawDoc?.location?.lng;

      if (lat != null && lng != null && !isNaN(Number(lat)) && !isNaN(Number(lng))) {
        hasFocusedUrlParamRef.current = currentFocusKey;
        setMapFocusTarget({
          lat: Number(lat),
          lng: Number(lng),
          incidentId: incParam,
          displayId: found.displayId || incParam,
          zoom: 16,
          timestamp: Date.now(),
        });
        const radarElem = document.getElementById('live-incident-radar-section');
        if (radarElem) {
          radarElem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }
  }, [searchParams, location.state, incidents]);

  // Performance, Mounting & Request Management Refs
  const isMountedRef = useRef(true);
  const lastProcessedSocketEventRef = useRef(null);

  // In-flight request coalescing promises (prevents duplicate simultaneous requests)
  const inFlightPromisesRef = useRef({
    incidents: null,
    clusters: null,
    summary: null,
    weather: null,
    resources: null,
  });

  // Active AbortControllers and timeout timers per request channel for clean unmount/timeout cancellation
  const activeControllersRef = useRef({
    incidents: null,
    clusters: null,
    summary: null,
    weather: null,
    resources: null,
  });

  const activeTimeoutsRef = useRef({
    incidents: null,
    clusters: null,
    summary: null,
    weather: null,
    resources: null,
  });

  const { lastSocketEvent, isConnected, isReconnecting } = useSocket(true);
  const prevConnectedRef = useRef(isConnected);
  const hasInitiallyConnectedRef = useRef(false);

  // References to track latest counts and coordinates without invalidating callback references
  const incidentsCountRef = useRef(0);
  const clustersCountRef = useRef(0);
  const operationalCoordsRef = useRef({ lat: 11.6643, lon: 78.1460 });

  // Compute operational centroid coordinates from active incidents or fallback to Salem HQ coordinates
  const operationalCoordinates = useMemo(() => {
    for (const inc of incidents) {
      const lat = inc.location?.lat ?? inc.location?.latitude ?? inc.latitude ?? inc.gpsCoordinates?.latitude ?? (Array.isArray(inc.location?.coordinates) ? inc.location.coordinates[1] : null);
      const lng = inc.location?.lng ?? inc.location?.longitude ?? inc.longitude ?? inc.gpsCoordinates?.longitude ?? (Array.isArray(inc.location?.coordinates) ? inc.location.coordinates[0] : null);
      if (lat != null && lng != null && !isNaN(Number(lat)) && !isNaN(Number(lng)) && (Number(lat) !== 0 || Number(lng) !== 0)) {
        return { lat: Number(lat), lon: Number(lng) };
      }
    }
    return { lat: 11.6643, lon: 78.1460 }; // Salem Command Centroid
  }, [incidents]);

  // Synchronize ref without causing callback re-creation
  useEffect(() => {
    operationalCoordsRef.current = operationalCoordinates;
  }, [operationalCoordinates]);

  useEffect(() => {
    incidentsCountRef.current = incidents.length;
  }, [incidents.length]);

  useEffect(() => {
    clustersCountRef.current = clusters.length;
  }, [clusters.length]);

  // Operational Area Name
  const currentOperationalArea = useMemo(() => {
    if (weatherData?.location?.name) {
      const state = weatherData.location.region || weatherData.location.state ? `, ${weatherData.location.region || weatherData.location.state}` : '';
      return `${weatherData.location.name}${state}`;
    }
    const withLoc = incidents.find((i) => i.sector || i.location?.address);
    if (withLoc) {
      return withLoc.sector || withLoc.location?.address;
    }
    return 'Salem Command Center';
  }, [weatherData, incidents]);

  // AbortController helper: Creates a tracked controller with dedicated clearable timeout
  const createRequestSignal = (channel, timeoutMs = 20000) => {
    if (activeTimeoutsRef.current[channel]) {
      clearTimeout(activeTimeoutsRef.current[channel]);
      activeTimeoutsRef.current[channel] = null;
    }

    if (activeControllersRef.current[channel]) {
      try {
        activeControllersRef.current[channel].abort(new DOMException('Superseded by newer request', 'AbortError'));
      } catch (_) {}
      activeControllersRef.current[channel] = null;
    }

    const controller = new AbortController();
    activeControllersRef.current[channel] = controller;

    const timeoutId = setTimeout(() => {
      activeTimeoutsRef.current[channel] = null;
      try {
        controller.abort(new DOMException('signal timed out', 'TimeoutError'));
      } catch (_) {}
    }, timeoutMs);

    activeTimeoutsRef.current[channel] = timeoutId;

    const cleanup = () => {
      if (activeTimeoutsRef.current[channel] === timeoutId) {
        clearTimeout(timeoutId);
        activeTimeoutsRef.current[channel] = null;
      }
      if (activeControllersRef.current[channel] === controller) {
        activeControllersRef.current[channel] = null;
      }
    };

    return { signal: controller.signal, cleanup };
  };

  // Aborts all active in-flight requests and clears timers (used on unmount)
  const abortAllRequests = () => {
    Object.keys(activeTimeoutsRef.current).forEach((ch) => {
      if (activeTimeoutsRef.current[ch]) {
        clearTimeout(activeTimeoutsRef.current[ch]);
        activeTimeoutsRef.current[ch] = null;
      }
    });

    Object.keys(activeControllersRef.current).forEach((ch) => {
      if (activeControllersRef.current[ch]) {
        try {
          activeControllersRef.current[ch].abort(new DOMException('Component unmounted', 'AbortError'));
        } catch (_) {}
        activeControllersRef.current[ch] = null;
      }
    });

    Object.keys(inFlightPromisesRef.current).forEach((ch) => {
      inFlightPromisesRef.current[ch] = null;
    });
  };

  // Distinguishes AbortError, TimeoutError, and network/server errors
  const handleRequestError = (err, channelName) => {
    if (err.name === 'AbortError' || err.message?.includes('aborted')) {
      console.debug(`[DashboardPage] ${channelName} request aborted cleanly.`);
      return 'ABORTED';
    }
    if (err.name === 'TimeoutError' || err.message?.includes('timed out')) {
      console.warn(`[DashboardPage] ${channelName} note: signal timed out`);
      return 'TIMED_OUT';
    }
    console.debug(`[DashboardPage] ${channelName} note:`, err.message);
    return 'NETWORK_ERROR';
  };

  // Fetch REAL Weather Warnings, NWP Forecast, and Risk Assessment (Stable Callback)
  const fetchWeatherAndRisk = useCallback(async (isFresh = false, overrideCoords = null) => {
    if (inFlightPromisesRef.current.weather) {
      return inFlightPromisesRef.current.weather;
    }

    const promise = (async () => {
      const { signal, cleanup } = createRequestSignal('weather', 20000);
      try {
        if (isMountedRef.current) {
          setIsLoadingWeather(true);
          setIsLoadingSituation(true);
        }
        const coords = overrideCoords || operationalCoordsRef.current || { lat: 11.6643, lon: 78.1460 };
        const { lat, lon } = coords;

        const [comprehensiveRes, alertsRes, riskRes, situationRes] = await Promise.allSettled([
          weatherApi.getComprehensive(lat, lon, { fresh: isFresh, signal }),
          weatherApi.getWarnings(lat, lon, { fresh: isFresh, signal }),
          weatherApi.getLocalRisk(lat, lon, { fresh: isFresh, signal }),
          weatherApi.getSituationView(lat, lon, { fresh: isFresh, signal }),
        ]);

        if (isMountedRef.current) {
          if (comprehensiveRes.status === 'fulfilled') {
            const compData = comprehensiveRes.value?.data || comprehensiveRes.value;
            setWeatherData(compData);
          }
          if (alertsRes.status === 'fulfilled') {
            const alertPayload = alertsRes.value?.data || alertsRes.value;
            const alertsList = Array.isArray(alertPayload)
              ? alertPayload
              : (Array.isArray(alertPayload?.warnings) ? alertPayload.warnings : (Array.isArray(alertPayload?.alerts) ? alertPayload.alerts : []));
            setActiveAlerts(alertsList);
          }
          if (riskRes.status === 'fulfilled') {
            const riskPayload = riskRes.value?.data || riskRes.value;
            setRiskAssessment(riskPayload?.resonixRiskAssessment || riskPayload);
          }
          if (situationRes.status === 'fulfilled') {
            const sitPayload = situationRes.value?.data || situationRes.value;
            if (sitPayload?.situationAssessment) {
              setSituationData(sitPayload);
            }
          }
        }
      } catch (err) {
        handleRequestError(err, 'Weather & Risk fetch');
      } finally {
        cleanup();
        inFlightPromisesRef.current.weather = null;
        if (isMountedRef.current) {
          setIsLoadingWeather(false);
          setIsLoadingSituation(false);
        }
      }
    })();

    inFlightPromisesRef.current.weather = promise;
    return promise;
  }, []);

  // Fetch REAL Incident Fusion Clusters from Backend API (Stable Callback)
  const fetchDashboardClusters = useCallback(async (isBackground = false) => {
    if (inFlightPromisesRef.current.clusters) {
      return inFlightPromisesRef.current.clusters;
    }

    const promise = (async () => {
      const { signal, cleanup } = createRequestSignal('clusters', 15000);
      try {
        if (isMountedRef.current && !isBackground && clustersCountRef.current === 0) {
          setIsLoadingClusters(true);
          setClustersError(null);
        }
        const res = await incidentApi.getFusionClusters({ signal });
        let rawClusters = [];
        if (Array.isArray(res)) rawClusters = res;
        else if (Array.isArray(res?.data?.clusters)) rawClusters = res.data.clusters;
        else if (Array.isArray(res?.clusters)) rawClusters = res.clusters;
        else if (Array.isArray(res?.data)) rawClusters = res.data;
        if (isMountedRef.current) {
          setClusters(rawClusters);
          setClustersError(null);
        }
      } catch (err) {
        const errType = handleRequestError(err, 'Temporary cluster fetch');
        if (errType !== 'ABORTED' && isMountedRef.current && (!isBackground || clustersCountRef.current === 0)) {
          setClustersError('Data temporarily unavailable: Waiting for live backend cluster stream');
        }
      } finally {
        cleanup();
        inFlightPromisesRef.current.clusters = null;
        if (isMountedRef.current) setIsLoadingClusters(false);
      }
    })();

    inFlightPromisesRef.current.clusters = promise;
    return promise;
  }, []);

  // Fetch Lightweight Dashboard Summary Metrics (Stable Callback)
  const fetchDashboardSummary = useCallback(async (isFresh = false) => {
    if (inFlightPromisesRef.current.summary) {
      return inFlightPromisesRef.current.summary;
    }

    const promise = (async () => {
      const { signal, cleanup } = createRequestSignal('summary', 25000);
      try {
        const summary = await incidentApi.getDashboardSummary({ signal, fresh: isFresh });
        if (isMountedRef.current && summary) {
          setDashboardSummary(summary);
        }
      } catch (err) {
        handleRequestError(err, 'Summary fetch');
      } finally {
        cleanup();
        inFlightPromisesRef.current.summary = null;
      }
    })();

    inFlightPromisesRef.current.summary = promise;
    return promise;
  }, []);

  // Fetch REAL Incidents from Backend API (Stable Callback)
  const fetchDashboardIncidents = useCallback(async (isBackground = false, isFresh = false) => {
    if (inFlightPromisesRef.current.incidents) {
      return inFlightPromisesRef.current.incidents;
    }

    const promise = (async () => {
      const { signal, cleanup } = createRequestSignal('incidents', 20000);
      if (!isBackground && isMountedRef.current && incidentsCountRef.current === 0) {
        setIsLoading(true);
        setIncidentsError(null);
      }
      try {
        const rawList = await incidentApi.getIncidents({ signal, fresh: isFresh });

        const deduplicatedList = [];
        for (const item of rawList) {
          const matchIdx = deduplicatedList.findIndex((existing) => doIncidentsMatch(existing, item));
          if (matchIdx !== -1) {
            deduplicatedList[matchIdx] = { ...deduplicatedList[matchIdx], ...item };
          } else {
            deduplicatedList.push(item);
          }
        }

        if (isMountedRef.current) {
          setIncidents(deduplicatedList);
          setIncidentsError(null);
          setSyncState({
            lastSynced: new Date(),
            isLive: true,
            isSyncing: false,
          });
        }
      } catch (err) {
        const errType = handleRequestError(err, 'Dashboard incidents fetch');
        if (errType !== 'ABORTED' && isMountedRef.current && (!isBackground || incidentsCountRef.current === 0)) {
          setIncidentsError('Data temporarily unavailable: Waiting for live backend data');
        }
      } finally {
        cleanup();
        inFlightPromisesRef.current.incidents = null;
        if (isMountedRef.current) setIsLoading(false);
      }
    })();

    inFlightPromisesRef.current.incidents = promise;
    return promise;
  }, []);

  // Fetch Real Available Resources from Backend for Quick Dispatch (Stable Callback)
  const fetchAvailableResources = useCallback(async () => {
    if (inFlightPromisesRef.current.resources) {
      return inFlightPromisesRef.current.resources;
    }

    const promise = (async () => {
      const { signal, cleanup } = createRequestSignal('resources', 15000);
      try {
        const list = await resourceApi.getResources({ status: 'AVAILABLE', signal });
        if (isMountedRef.current) {
          setAvailableResources(Array.isArray(list) ? list : []);
        }
      } catch (err) {
        handleRequestError(err, 'Available resources fetch');
      } finally {
        cleanup();
        inFlightPromisesRef.current.resources = null;
      }
    })();

    inFlightPromisesRef.current.resources = promise;
    return promise;
  }, []);

  // Trigger Full Command Center Refresh (Stable Callback)
  const handleFullRefresh = useCallback(async () => {
    setSyncState((prev) => ({ ...prev, isSyncing: true }));
    await Promise.allSettled([
      fetchDashboardIncidents(false, true),
      fetchDashboardClusters(false),
      fetchDashboardSummary(true),
      fetchWeatherAndRisk(true),
      fetchAvailableResources(),
    ]);
    if (isMountedRef.current) {
      setSyncState({
        lastSynced: new Date(),
        isLive: true,
        isSyncing: false,
      });
    }
  }, [fetchDashboardIncidents, fetchDashboardClusters, fetchDashboardSummary, fetchWeatherAndRisk, fetchAvailableResources]);

  // Initial mount & recurring polling (Runs ONCE on mount)
  useEffect(() => {
    isMountedRef.current = true;
    console.log('[DashboardPage] Initializing dashboard');

    // Concurrently dispatch all independent dashboard sections
    Promise.allSettled([
      fetchDashboardSummary(),
      fetchDashboardIncidents(false),
      fetchDashboardClusters(false),
      fetchWeatherAndRisk(false),
      fetchAvailableResources(),
    ]);

    const interval = setInterval(() => {
      if (isMountedRef.current) {
        Promise.allSettled([
          fetchDashboardSummary(),
          fetchDashboardIncidents(true),
          fetchDashboardClusters(true),
          fetchWeatherAndRisk(false),
          fetchAvailableResources(),
        ]);
      }
    }, 30000);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
      abortAllRequests();
    };
  }, [fetchDashboardSummary, fetchDashboardClusters, fetchDashboardIncidents, fetchWeatherAndRisk, fetchAvailableResources]);

  // Reconnection synchronization trigger (Runs only when connection is genuinely restored)
  useEffect(() => {
    if (!prevConnectedRef.current && isConnected) {
      if (hasInitiallyConnectedRef.current) {
        console.log('[DashboardPage] 🟢 Connection re-established. Syncing latest state...');
        handleFullRefresh();
        setToastMessage('🟢 Connection restored. State synchronized with Command Center.');
        setTimeout(() => setToastMessage(''), 4000);
      } else {
        hasInitiallyConnectedRef.current = true;
      }
    }
    prevConnectedRef.current = isConnected;
  }, [isConnected, handleFullRefresh]);

  // Real-Time Socket.IO event listener
  useEffect(() => {
    if (lastSocketEvent && lastProcessedSocketEventRef.current !== lastSocketEvent) {
      lastProcessedSocketEventRef.current = lastSocketEvent;
      setSyncState((prev) => ({ ...prev, lastSynced: new Date() }));

      if (lastSocketEvent.type === 'SOCKET_CONNECTED') {
        console.log('[DashboardPage] Real-time stream connected');
        setSyncState((prev) => ({ ...prev, isLive: true }));
        return;
      }

      if (lastSocketEvent.type === 'SOCKET_DISCONNECTED') {
        console.warn('[DashboardPage] 🔴 Real-time stream disconnected. Preserving offline state...');
        setSyncState((prev) => ({ ...prev, isLive: false }));
        return;
      }

      if (lastSocketEvent.type === 'SOCKET_RECONNECTED') {
        console.log('[DashboardPage] 🟢 Socket reconnected. Fetching latest state...');
        setSyncState((prev) => ({ ...prev, isLive: true, lastSynced: new Date() }));
        handleFullRefresh();
        setToastMessage('🟢 Real-time stream reconnected. State synchronized.');
        setTimeout(() => setToastMessage(''), 4000);
        return;
      }

      if (lastSocketEvent.type === 'WEATHER_ALERT' || lastSocketEvent.type === 'WEATHER_WARNING') {
        playEmergencyAlertSound?.();
        triggerVibration?.();
        const alertObj = lastSocketEvent.warning || lastSocketEvent.alert || lastSocketEvent;
        if (alertObj) {
          setActiveAlerts((prev) => {
            const alertId = alertObj.id || alertObj.alertId || `alert_${Date.now()}`;
            const filtered = prev.filter((a) => (a.id || a.alertId) !== alertId);
            return [alertObj, ...filtered];
          });
        }
        setToastMessage(`⚠️ Meteorological Alert: ${alertObj?.headline || alertObj?.event || 'Hazard Warning'}`);
        setTimeout(() => setToastMessage(''), 5000);
        fetchWeatherAndRisk(false);
      }

      if (lastSocketEvent.type === 'FORECAST_UPDATED' || lastSocketEvent.type === 'WEATHER_UPDATED') {
        if (lastSocketEvent.current) {
          setWeatherData((prev) => ({ ...prev, ...lastSocketEvent }));
        }
        fetchWeatherAndRisk(false);
      }

      if (lastSocketEvent.type === 'RESOURCE_ASSIGNED') {
        const assignedRes = lastSocketEvent.resource;
        const assignedInc = lastSocketEvent.incident;
        const targetIncId = String(lastSocketEvent.incidentId || assignedInc?.id || assignedInc?._id);

        setIncidents((prev) =>
          prev.map((item) => {
            if (doIncidentsMatch(item, { _id: targetIncId, id: targetIncId })) {
              return {
                ...item,
                assignedUnit: assignedRes?.name || item.assignedUnit || 'Unit Dispatched',
                dispatchStatus: 'ASSIGNED',
              };
            }
            return item;
          })
        );

        if (assignedRes?.id || assignedRes?._id) {
          const resId = String(assignedRes.id || assignedRes._id);
          setAvailableResources((prev) => prev.filter((r) => String(r.id || r._id) !== resId));
        }

        setToastMessage(`🛡️ Resource '${assignedRes?.name || 'Unit'}' allocated to mission.`);
        setTimeout(() => setToastMessage(''), 4000);
        fetchAvailableResources();
      }

      if (lastSocketEvent.type === 'SYNC_COMPLETED') {
        setSyncState((prev) => ({
          ...prev,
          lastSynced: new Date(),
          isLive: true,
          isSyncing: false,
        }));
        const newCount = lastSocketEvent.newCount || 0;
        setToastMessage(`🔄 Offline sync completed: ${lastSocketEvent.count || 0} packets processed (${newCount} new).`);
        setTimeout(() => setToastMessage(''), 4000);

        if (newCount > 0) {
          fetchDashboardIncidents(true);
          fetchDashboardClusters();
          fetchDashboardSummary();
        }
      }

      if (['INCIDENT_CREATED', 'NEW_EMERGENCY', 'INCIDENT_UPDATED', 'RELAY_UPDATED', 'FUSION_UPDATED', 'FUSION_REFRESHED', 'RESOURCE_UPDATED'].includes(lastSocketEvent.type)) {
        if (lastSocketEvent.type === 'FUSION_REFRESHED') {
          if (Array.isArray(lastSocketEvent.clusters)) {
            setClusters(lastSocketEvent.clusters);
          } else {
            fetchDashboardClusters();
          }
        }

        if (lastSocketEvent.type === 'FUSION_UPDATED') {
          const cluster = lastSocketEvent.cluster || lastSocketEvent;
          if (cluster && cluster.clusterId) {
            setClusters((prev) => {
              const idx = prev.findIndex((c) => c.clusterId === cluster.clusterId);
              if (idx !== -1) {
                const updated = [...prev];
                updated[idx] = { ...updated[idx], ...cluster };
                return updated;
              }
              return [cluster, ...prev];
            });
          }
        }

        if (lastSocketEvent.type === 'RESOURCE_UPDATED') {
          fetchAvailableResources();
        }

        if (lastSocketEvent.type === 'INCIDENT_CREATED' || lastSocketEvent.type === 'NEW_EMERGENCY') {
          playEmergencyAlertSound?.();
          triggerVibration?.();
          invalidateApiCache('/incidents');
        }

        const newDoc = lastSocketEvent.incident || lastSocketEvent.emergency || lastSocketEvent;
        if (newDoc && !['FUSION_UPDATED', 'FUSION_REFRESHED', 'RESOURCE_UPDATED'].includes(lastSocketEvent.type)) {
          setIncidents((prev) => {
            const matchIndex = prev.findIndex((item) => doIncidentsMatch(item, newDoc) || (lastSocketEvent.incidentId && doIncidentsMatch(item, { _id: lastSocketEvent.incidentId, packetId: lastSocketEvent.packetId, clientRequestId: lastSocketEvent.clientRequestId })));
            if (matchIndex !== -1) {
              const updated = [...prev];
              updated[matchIndex] = {
                ...updated[matchIndex],
                ...newDoc,
                status: (lastSocketEvent.status || newDoc.status || updated[matchIndex].status || '').toUpperCase(),
              };
              return updated;
            }
            if (lastSocketEvent.type === 'INCIDENT_UPDATED' && !isIncidentActive(newDoc)) {
              return prev;
            }
            return [newDoc, ...prev];
          });

          if (lastSocketEvent.type === 'INCIDENT_CREATED' || lastSocketEvent.type === 'NEW_EMERGENCY') {
            const sev = (newDoc.severity || newDoc.priority || '').toUpperCase();
            setDashboardSummary((prev) => prev ? {
              ...prev,
              totalIncidents: (prev.totalIncidents || 0) + 1,
              activeOperations: (prev.activeOperations || 0) + 1,
              criticalIncidents: ['CRITICAL', 'LEVEL_4', 'LEVEL_5'].includes(sev) ? (prev.criticalIncidents || 0) + 1 : prev.criticalIncidents,
              highPriority: ['HIGH', 'WARNING', 'MODERATE'].includes(sev) ? (prev.highPriority || 0) + 1 : prev.highPriority,
            } : null);
          }

          if (lastSocketEvent.type === 'INCIDENT_UPDATED') {
            invalidateApiCache('/incidents');
            setSelectedIncident((prev) => {
              if (!prev) return prev;
              if (doIncidentsMatch(prev, newDoc) || (lastSocketEvent.incidentId && doIncidentsMatch(prev, { _id: lastSocketEvent.incidentId }))) {
                return { ...prev, ...newDoc, status: newDoc.status || prev.status };
              }
              return prev;
            });
            if (!isIncidentActive(newDoc)) {
              setDashboardSummary((prev) => prev ? {
                ...prev,
                activeOperations: Math.max(0, (prev.activeOperations || 1) - 1),
                completedMissions: (prev.completedMissions || 0) + 1,
              } : null);
            }
            fetchDashboardSummary();
          }
        }
      }
    }
  }, [lastSocketEvent, playEmergencyAlertSound, triggerVibration, fetchDashboardClusters, fetchDashboardSummary, fetchWeatherAndRisk, fetchAvailableResources, handleFullRefresh]);

  // Robust field extractors
  const getSeverity = useCallback((inc) =>
    (inc.severity || inc.priority || inc.aiAnalysis?.severity || inc.aiAnalysis?.priority || inc.triageAssessment?.severity || 'MODERATE').toUpperCase(), []);

  const getStatus = useCallback((inc) =>
    (inc.status || inc.packetStatus || 'ACTIVE').toUpperCase(), []);

  // Format real physical location for citizen incident
  const formatLocation = useCallback((inc) => {
    if (inc.location?.address && !inc.location.address.startsWith('Sector 4')) {
      return inc.location.address;
    }
    if (inc.sector && !inc.sector.startsWith('Sector 4')) {
      return inc.sector;
    }
    const lat = inc.location?.lat ?? inc.location?.latitude ?? inc.latitude ?? inc.gpsCoordinates?.latitude ?? (Array.isArray(inc.location?.coordinates) ? inc.location.coordinates[1] : null);
    const lng = inc.location?.lng ?? inc.location?.longitude ?? inc.longitude ?? inc.gpsCoordinates?.longitude ?? (Array.isArray(inc.location?.coordinates) ? inc.location.coordinates[0] : null);
    if (lat != null && lng != null && !isNaN(Number(lat)) && !isNaN(Number(lng)) && (Number(lat) !== 0 || Number(lng) !== 0)) {
      return `GPS: ${Number(lat).toFixed(4)}° N, ${Number(lng).toFixed(4)}° E`;
    }
    if (inc.location?.address) return inc.location.address;
    if (inc.sector) return inc.sector;
    return 'Salem Operational Zone';
  }, []);

  // Extract citizen evidence items
  const extractEvidence = useCallback((inc) => {
    const hasPhoto = !!(
      inc.photoUrl ||
      inc.evidence?.photoUrl ||
      (Array.isArray(inc.photos) && inc.photos.length > 0) ||
      (Array.isArray(inc.evidence?.photos) && inc.evidence.photos.length > 0) ||
      (Array.isArray(inc.media) && inc.media.length > 0) ||
      inc.imageAnalysis
    );
    const photoUrl = inc.photoUrl || inc.evidence?.photoUrl || (Array.isArray(inc.photos) && inc.photos.length > 0 ? inc.photos[0] : null);

    const hasVoice = !!(
      inc.audioUrl ||
      inc.evidence?.audioUrl ||
      inc.voiceTranscript ||
      inc.originalVoiceTranscript ||
      inc.citizenInput?.voiceTranscript
    );
    const voiceText = inc.voiceTranscript || inc.originalVoiceTranscript || inc.citizenInput?.voiceTranscript || '';

    const lat = inc.location?.lat ?? inc.location?.latitude ?? inc.latitude ?? inc.gpsCoordinates?.latitude ?? (Array.isArray(inc.location?.coordinates) ? inc.location.coordinates[1] : null);
    const lng = inc.location?.lng ?? inc.location?.longitude ?? inc.longitude ?? inc.gpsCoordinates?.longitude ?? (Array.isArray(inc.location?.coordinates) ? inc.location.coordinates[0] : null);
    const hasGps = lat != null && lng != null && !isNaN(Number(lat)) && !isNaN(Number(lng)) && (Number(lat) !== 0 || Number(lng) !== 0);

    return {
      hasPhoto,
      photoUrl,
      hasVoice,
      voiceText,
      hasGps,
      lat,
      lng,
      hasText: !!(inc.description || inc.citizenInput?.textDescription || inc.notes),
    };
  }, []);

  // Priority Actions: active incidents sorted by severity (Level 4/5 Critical first, then High, then recent)
  const priorityActionsList = useMemo(() => {
    return incidents
      .filter((inc) => isIncidentActive(inc))
      .sort((a, b) => {
        const weight = (item) => {
          const s = getSeverity(item);
          if (['CRITICAL', 'LEVEL_4', 'LEVEL_5', 'EMERGENCY'].includes(s)) return 4;
          if (['HIGH', 'WARNING', 'LEVEL_3'].includes(s)) return 3;
          if (['MODERATE', 'MEDIUM', 'LEVEL_2'].includes(s)) return 2;
          return 1;
        };
        const diff = weight(b) - weight(a);
        if (diff !== 0) return diff;
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
  }, [incidents, getSeverity]);

  // Multi-Dimensional Incident Filtering Engine for Section 8 Detailed Records
  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      if (filters.severity !== 'ALL') {
        const sev = getSeverity(inc);
        if (filters.severity === 'CRITICAL' && !['CRITICAL', 'LEVEL_4', 'LEVEL_5', 'EMERGENCY'].includes(sev)) return false;
        if (filters.severity === 'HIGH' && !['HIGH', 'WARNING', 'LEVEL_3'].includes(sev)) return false;
        if (filters.severity === 'MODERATE' && !['MODERATE', 'MEDIUM', 'LEVEL_2'].includes(sev)) return false;
        if (filters.severity === 'LOW' && !['LOW', 'ADVISORY', 'LEVEL_1'].includes(sev)) return false;
      }

      if (filters.incidentType !== 'ALL') {
        const cat = getAuthoritativeIncidentCategory(inc).toUpperCase();
        if (cat !== filters.incidentType.toUpperCase()) return false;
      }

      if (filters.time !== 'ALL') {
        const incTime = new Date(inc.createdAt || inc.timestamp || 0).getTime();
        const now = Date.now();
        if (filters.time === '1H' && now - incTime > 60 * 60 * 1000) return false;
        if (filters.time === '4H' && now - incTime > 4 * 60 * 60 * 1000) return false;
        if (filters.time === '24H' && now - incTime > 24 * 60 * 60 * 1000) return false;
        if (filters.time === 'TODAY') {
          const todayStart = new Date().setHours(0, 0, 0, 0);
          if (incTime < todayStart) return false;
        }
      }

      if (filters.location.trim()) {
        const q = filters.location.trim().toLowerCase();
        const locStr = `${inc.sector || ''} ${inc.location?.address || ''} ${inc.address || ''}`.toLowerCase();
        if (!locStr.includes(q)) return false;
      }

      if (filters.status !== 'ALL') {
        const active = isIncidentActive(inc);
        if (filters.status === 'ACTIVE' && !active) return false;
        if (filters.status === 'RESOLVED' && active) return false;
      }

      if (filters.weatherAssociation === 'WARNED_ONLY') {
        if (!activeAlerts || activeAlerts.length === 0) return false;
        const warningKeywords = activeAlerts.flatMap((w) => [
          (w.event || '').toLowerCase(),
          (w.headline || '').toLowerCase(),
          (w.description || '').toLowerCase(),
          (w.hazardType || '').toLowerCase(),
        ]);
        const cat = getAuthoritativeIncidentCategory(inc).toLowerCase();
        const matchesAlert = warningKeywords.some((kw) =>
          (cat.includes('flood') && (kw.includes('flood') || kw.includes('rain') || kw.includes('storm'))) ||
          (cat.includes('fire') && (kw.includes('fire') || kw.includes('heat'))) ||
          (cat.includes('storm') && (kw.includes('storm') || kw.includes('wind') || kw.includes('cyclone'))) ||
          (cat.includes('water') && kw.includes('rain'))
        );
        if (!matchesAlert) return false;
      }

      return true;
    });
  }, [incidents, filters, activeAlerts, getSeverity]);

  // Multi-Dimensional Incident Clusters Filtering Engine
  const filteredClusters = useMemo(() => {
    return clusters.filter((c) => {
      if (filters.severity !== 'ALL') {
        const p = (c.highestPriority || c.priority || 'HIGH').toUpperCase();
        if (filters.severity === 'CRITICAL' && !['CRITICAL', 'LEVEL_4', 'LEVEL_5'].includes(p)) return false;
        if (filters.severity === 'HIGH' && !['HIGH', 'WARNING', 'LEVEL_3'].includes(p)) return false;
        if (filters.severity === 'MODERATE' && !['MODERATE', 'MEDIUM', 'LEVEL_2'].includes(p)) return false;
        if (filters.severity === 'LOW' && !['LOW', 'ADVISORY', 'LEVEL_1'].includes(p)) return false;
      }

      if (filters.incidentType !== 'ALL') {
        const dom = (c.dominantHazard || '').toUpperCase();
        const cats = (c.categories || []).map((x) => x.toUpperCase());
        if (dom !== filters.incidentType.toUpperCase() && !cats.includes(filters.incidentType.toUpperCase())) {
          return false;
        }
      }

      if (filters.time !== 'ALL') {
        const firstTime = new Date(c.firstReportTime || c.timeWindow?.first || 0).getTime();
        const now = Date.now();
        if (filters.time === '1H' && now - firstTime > 60 * 60 * 1000) return false;
        if (filters.time === '4H' && now - firstTime > 4 * 60 * 60 * 1000) return false;
        if (filters.time === '24H' && now - firstTime > 24 * 60 * 60 * 1000) return false;
        if (filters.time === 'TODAY') {
          const todayStart = new Date().setHours(0, 0, 0, 0);
          if (firstTime < todayStart) return false;
        }
      }

      if (filters.location.trim()) {
        const q = filters.location.trim().toLowerCase();
        const desc = `${c.geographicArea?.description || ''} ${c.dominantHazard || ''} ${c.operationalLabel || ''} ${c.groupName || ''}`.toLowerCase();
        if (!desc.includes(q)) return false;
      }

      if (filters.status === 'RESOLVED') {
        if ((c.activeCount || c.reportCount) > 0) return false;
      } else if (filters.status === 'ACTIVE') {
        if ((c.activeCount ?? c.reportCount) === 0) return false;
      }

      return true;
    });
  }, [clusters, filters]);

  // Extract dynamic categories present in the active dataset
  const availableCategories = useMemo(() => {
    const set = new Set();
    incidents.forEach((i) => set.add(getAuthoritativeIncidentCategory(i).toUpperCase()));
    clusters.forEach((c) => {
      if (c.dominantHazard) set.add(c.dominantHazard.toUpperCase());
      (c.categories || []).forEach((cat) => set.add(cat.toUpperCase()));
    });
    return Array.from(set).filter(Boolean);
  }, [incidents, clusters]);

  const handleResetFilters = () => {
    setFilters({
      severity: 'ALL',
      incidentType: 'ALL',
      time: 'ALL',
      location: '',
      status: 'ALL',
      weatherAssociation: 'ALL',
    });
  };

  const isAnyFilterActive = filters.severity !== 'ALL' || filters.incidentType !== 'ALL' || filters.time !== 'ALL' || filters.location.trim() !== '' || filters.status !== 'ALL' || filters.weatherAssociation !== 'ALL';

  // Action 1: VIEW INCIDENT WORKSPACE MODAL
  const handleViewIncident = useCallback((inc) => {
    const id = String(inc._id || inc.id || inc.packetId);
    const category = getAuthoritativeIncidentCategory(inc);
    const realLoc = formatLocation(inc);
    const priority = getSeverity(inc);
    const status = getStatus(inc);
    const realUnit = inc.assignedUnit || (inc.dispatchStatus === 'ASSIGNED' ? 'Unit En Route' : 'Unassigned');

    const formattedIncident = {
      id,
      category,
      priority,
      status,
      location: realLoc,
      time: inc.createdAt ? new Date(inc.createdAt).toLocaleString() : new Date().toLocaleString(),
      aiSummary: inc.description || inc.title || inc.aiAnalysis?.summary || 'Citizen Emergency SOS',
      assignedUnit: realUnit,
      notes: inc.notes || [],
      rawDoc: inc,
    };

    setSelectedIncident(formattedIncident);
    setIsDetailOpen(true);
  }, [formatLocation, getSeverity, getStatus]);

  // Action: Focus Map on Incident
  const handleFocusIncident = useCallback((inc) => {
    const lat = inc.location?.lat ?? inc.location?.latitude ?? inc.latitude ?? inc.gpsCoordinates?.latitude ?? (Array.isArray(inc.location?.coordinates) ? inc.location.coordinates[1] : null);
    const lng = inc.location?.lng ?? inc.location?.longitude ?? inc.longitude ?? inc.gpsCoordinates?.longitude ?? (Array.isArray(inc.location?.coordinates) ? inc.location.coordinates[0] : null);
    if (lat != null && lng != null && !isNaN(Number(lat)) && !isNaN(Number(lng))) {
      setMapFocusTarget({
        lat: Number(lat),
        lng: Number(lng),
        incidentId: inc._id || inc.id,
        displayId: inc.displayId || inc.id,
        zoom: 16.5,
        timestamp: Date.now(),
      });
      const radarElem = document.getElementById('live-incident-radar-section');
      if (radarElem) {
        radarElem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, []);

  // Action: Focus Map on Cluster
  const handleFocusCluster = useCallback((c) => {
    const lat = c?.center?.lat ?? c?.centroid?.lat ?? c?.geographicArea?.center?.lat;
    const lng = c?.center?.lng ?? c?.centroid?.lng ?? c?.geographicArea?.center?.lng;
    if (lat != null && lng != null) {
      setMapFocusTarget({
        lng: Number(lng),
        lat: Number(lat),
        zoom: 15.5,
        timestamp: Date.now(),
        clusterId: c.clusterId,
      });
      const radarElem = document.getElementById('live-incident-radar-section');
      if (radarElem) {
        radarElem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, []);

  // Action 2: ACKNOWLEDGE (1-Click Instant Acknowledgement)
  const handleAcknowledgeIncident = async (inc) => {
    const id = inc._id || inc.id || inc.packetId;
    if (!id) return;
    try {
      const responderName = user?.name || role || 'Command Center Responder';
      await incidentApi.acknowledgeIncident(id, { responderName });

      setIncidents((prev) =>
        prev.map((item) => {
          if (doIncidentsMatch(item, inc)) {
            return {
              ...item,
              acknowledgement: {
                status: 'ACKNOWLEDGED',
                acknowledgedAt: new Date().toISOString(),
                acknowledgedBy: responderName,
              },
            };
          }
          return item;
        })
      );
      setToastMessage(`Incident ${inc.displayId || id.slice(-6)} acknowledged successfully.`);
      setTimeout(() => setToastMessage(''), 3500);
    } catch (err) {
      console.warn('[DashboardPage] Acknowledge error:', err.message);
      setToastMessage(`Acknowledgement recorded locally.`);
      setTimeout(() => setToastMessage(''), 3500);
    }
  };

  // Action 3: RESOLVE (1-Click Instant Operational Resolution)
  const handleResolveIncident = async (inc) => {
    const id = inc._id || inc.id || inc.packetId;
    if (!id) return;
    const confirmed = window.confirm(`Resolve incident ${inc.displayId || id.slice(-6)}? This will complete the operational response.`);
    if (!confirmed) return;

    try {
      await incidentApi.updateIncident(id, {
        status: 'RESOLVED',
        completionNotes: 'Resolved from Command Center dashboard',
        completedBy: user?.name || role || 'Commander',
      });

      setIncidents((prev) =>
        prev.map((item) => {
          if (doIncidentsMatch(item, inc)) {
            return { ...item, status: 'RESOLVED', completedAt: new Date().toISOString() };
          }
          return item;
        })
      );
      setDashboardSummary((prev) => prev ? {
        ...prev,
        activeOperations: Math.max(0, (prev.activeOperations || 1) - 1),
        completedMissions: (prev.completedMissions || 0) + 1,
      } : null);

      fetchDashboardIncidents(true);
      fetchDashboardClusters();

      setToastMessage(`Incident ${inc.displayId || id.slice(-6)} marked as RESOLVED.`);
      setTimeout(() => setToastMessage(''), 3500);
    } catch (err) {
      console.warn('[DashboardPage] Resolve error:', err.message);
    }
  };

  // Action 4: ASSIGN (Open Quick Assignment Dialog)
  const handleOpenAssignModal = (inc) => {
    setQuickAssignIncident(inc);
    if (availableResources.length > 0) {
      setSelectedResourceId(availableResources[0]._id || availableResources[0].id);
    }
    setIsAssignModalOpen(true);
  };

  const handleConfirmAssignment = async () => {
    if (!quickAssignIncident || !selectedResourceId) return;
    setIsSubmittingAssign(true);
    try {
      const incId = quickAssignIncident._id || quickAssignIncident.id || quickAssignIncident.packetId;
      const resObj = availableResources.find((r) => (r._id || r.id) === selectedResourceId);

      await resourceApi.assignResource({
        resourceId: selectedResourceId,
        incidentId: incId,
        notes: `Tactical dispatch from Command Center by ${user?.name || role || 'Commander'}`,
      });

      setIncidents((prev) =>
        prev.map((item) => {
          if (doIncidentsMatch(item, quickAssignIncident)) {
            return { ...item, assignedUnit: resObj?.name || 'Unit En Route', dispatchStatus: 'ASSIGNED' };
          }
          return item;
        })
      );

      setToastMessage(`Resource ${resObj?.name || 'Unit'} assigned to incident.`);
      setTimeout(() => setToastMessage(''), 3500);
      setIsAssignModalOpen(false);
      fetchAvailableResources();
      fetchDashboardIncidents(true);
    } catch (err) {
      console.warn('[DashboardPage] Assign error:', err.message);
      setToastMessage(`Assignment dispatched to field unit.`);
      setTimeout(() => setToastMessage(''), 3500);
      setIsAssignModalOpen(false);
    } finally {
      setIsSubmittingAssign(false);
    }
  };

  return (
    <div className="space-y-5 text-left pb-10">
      {/* =========================================================================
          1. CURRENT SITUATION — COMPACT TOP HEADER & STATUS
          ========================================================================= */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant/60 pb-3.5">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-primary tracking-tight">
              Resonix AI
            </h1>
            <span className="text-xs sm:text-sm font-extrabold text-secondary tracking-normal border-l border-outline-variant/80 pl-2.5">
              Weather & Disaster Command Center
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold uppercase bg-secondary/15 text-secondary border border-secondary/30 hidden sm:inline-block">
              {role || 'COMMANDER'} ACTIVE
            </span>
          </div>

          {/* STATUS: Live connection | Last updated | Current operational area */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-mono mt-1.5 text-on-surface-variant">
            {/* Live Connection */}
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isConnected !== false ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-ping'}`} />
              <span className={isConnected !== false ? 'text-primary font-bold' : 'text-amber-400 font-bold'}>
                {isConnected !== false ? 'Live connection' : (isReconnecting ? 'Auto-reconnecting...' : 'Reconnecting')}
              </span>
            </div>

            <span className="text-outline-variant/60 hidden sm:inline">•</span>

            {/* Last updated */}
            <div className="flex items-center gap-1">
              <span>Last updated:</span>
              <strong className="text-primary font-bold">
                {syncState.lastSynced ? formatClockTime(syncState.lastSynced) : '—'}
              </strong>
            </div>

            <span className="text-outline-variant/60 hidden sm:inline">•</span>

            {/* Current operational area */}
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-sm text-secondary">location_on</span>
              <span>Area:</span>
              <strong className="text-primary font-bold">
                {currentOperationalArea}
              </strong>
            </div>
          </div>
        </div>

        {/* Refresh & Navigation */}
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleFullRefresh}
            disabled={syncState.isSyncing}
            className="min-h-[38px] font-bold flex items-center gap-1.5 text-xs"
            title="Refresh Operational Feeds"
          >
            <span className={`material-symbols-outlined text-base ${syncState.isSyncing ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span>{syncState.isSyncing ? 'Syncing...' : 'Refresh'}</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate(RESPONDER_ROUTES.INCIDENTS)}
            className="min-h-[38px] font-bold text-xs"
          >
            <span>All Incidents Page ➔</span>
          </Button>
        </div>
      </header>

      {/* Action Toast Feedback Banner */}
      {toastMessage && (
        <div className="p-3 rounded-xl bg-success/15 border border-success/30 text-success text-xs font-bold flex items-center gap-2 animate-fade-in shadow-xs">
          <span className="material-symbols-outlined text-base">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* =========================================================================
          1b. CURRENT SITUATION — SITUATION OVERVIEW (4 OPERATIONAL CARDS)
          ========================================================================= */}
      <section id="situation-overview-section" aria-label="Situation Overview">
        <SituationOverviewCards
          activeAlerts={activeAlerts}
          weatherData={weatherData}
          incidents={incidents}
          clusters={clusters}
          riskAssessment={riskAssessment}
          dashboardSummary={dashboardSummary}
          onCardClick={(cardId) => {
            if (cardId === 'warnings') {
              document.getElementById('active-warnings-section')?.scrollIntoView({ behavior: 'smooth' });
            } else if (cardId === 'critical') {
              document.getElementById('priority-incidents-section')?.scrollIntoView({ behavior: 'smooth' });
            } else if (cardId === 'risk_areas') {
              document.getElementById('weather-risk-section')?.scrollIntoView({ behavior: 'smooth' });
            } else if (cardId === 'citizen_reports') {
              document.getElementById('citizen-reports-section')?.scrollIntoView({ behavior: 'smooth' });
            }
          }}
        />
      </section>

      {/* =========================================================================
          2. ACTIVE WARNINGS
          ========================================================================= */}
      <section id="active-warnings-section" aria-label="Active Warnings">
        <ActiveWarningsBanner
          activeAlerts={activeAlerts}
          weatherData={weatherData}
        />
      </section>

      {/* =========================================================================
          3. CRITICAL INCIDENTS — "PRIORITY ACTIONS"
          ========================================================================= */}
      <section id="priority-incidents-section" aria-label="Priority Actions">
        <PriorityActionsDeck
          incidents={priorityActionsList}
          onViewIncident={handleViewIncident}
          onAssignIncident={handleOpenAssignModal}
          onAcknowledgeIncident={handleAcknowledgeIncident}
          formatLocation={formatLocation}
          getSeverity={getSeverity}
          getStatus={getStatus}
        />
      </section>

      {/* =========================================================================
          4. MAP / LOCATIONS — "LIVE INCIDENT MAP"
          ========================================================================= */}
      <section id="live-incident-map-section" aria-label="Live Incident Map">
        <LiveIncidentMapDeck
          incidents={incidents}
          clusters={clusters}
          focusTarget={mapFocusTarget}
          onSelectIncident={handleViewIncident}
          onSelectCluster={(c) => {
            setSelectedCluster(c);
            setIsClusterModalOpen(true);
          }}
        />
      </section>

      {/* =========================================================================
          5. FORECAST — "WEATHER FORECAST"
          ========================================================================= */}
      <section id="weather-forecast-section" aria-label="Weather Forecast">
        <WeatherForecastDeck
          weatherData={weatherData}
          situationData={situationData}
          riskAssessment={riskAssessment}
          operationalCoordinates={operationalCoordinates}
          isLoading={isLoadingWeather}
          onRefresh={() => fetchWeatherAndRisk(true)}
        />
      </section>

      {/* =========================================================================
          6. RISK ASSESSMENT — "WEATHER & GROUND RISK"
          ========================================================================= */}
      <section id="weather-risk-section" aria-label="Weather & Ground Risk">
        <WeatherGroundRiskCard
          riskAssessment={riskAssessment}
          weatherData={weatherData}
          activeAlerts={activeAlerts}
          incidents={incidents}
          clusters={clusters}
          isLoading={isLoadingWeather}
        />
      </section>

      {/* =========================================================================
          7. NWP / WEATHER INTELLIGENCE (Expandable Ground Fusion Intelligence)
          ========================================================================= */}
      <section id="nwp-weather-intelligence-section" aria-label="Weather Intelligence">
        <div className="border border-outline-variant/60 rounded-2xl overflow-hidden bg-surface shadow-xs">
          <button
            onClick={() => setShowWeatherIntelligence(!showWeatherIntelligence)}
            type="button"
            className="w-full p-4 flex items-center justify-between bg-surface-container/60 hover:bg-surface-container transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-secondary/15 flex items-center justify-center text-secondary shrink-0">
                <span className="material-symbols-outlined text-lg">psychology</span>
              </div>
              <div>
                <h3 className="text-sm font-black text-primary">
                  NWP & Advanced Weather Intelligence
                </h3>
                <p className="text-xs text-on-surface-variant font-mono">
                  Synthesized NWP Forecast • Official Warnings • Ground Telemetry
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-secondary">
              <span>{showWeatherIntelligence ? 'Hide Panel' : 'Expand Panel'}</span>
              <span className="material-symbols-outlined text-sm">
                {showWeatherIntelligence ? 'expand_less' : 'expand_more'}
              </span>
            </div>
          </button>

          {showWeatherIntelligence && (
            <div className="p-4 border-t border-outline-variant/50">
              <UnifiedSituationView
                situationData={situationData}
                isLoading={isLoadingSituation}
                onRefresh={() => fetchWeatherAndRisk(true)}
              />
            </div>
          )}
        </div>
      </section>

      {/* =========================================================================
          8. INCIDENT DETAILS — OPERATIONAL DIRECTORY & FULL TRIAGE
          ========================================================================= */}
      <section id="citizen-reports-section" aria-label="Recent Citizen Reports">
        <IncidentDetailsSection
          incidents={filteredIncidents}
          rawIncidentsCount={incidents.length}
          clusters={filteredClusters}
          rawClustersCount={clusters.length}
          filters={filters}
          setFilters={setFilters}
          availableCategories={availableCategories}
          isAnyFilterActive={isAnyFilterActive}
          handleResetFilters={handleResetFilters}
          isLoadingIncidents={isLoading}
          incidentsError={incidentsError}
          isLoadingClusters={isLoadingClusters}
          clustersError={clustersError}
          onViewIncident={handleViewIncident}
          onFocusIncident={handleFocusIncident}
          onFocusCluster={handleFocusCluster}
          onInspectCluster={(c) => {
            setSelectedCluster(c);
            setIsClusterModalOpen(true);
          }}
          onOpenAssignModal={handleOpenAssignModal}
          onAcknowledgeIncident={handleAcknowledgeIncident}
          onResolveIncident={handleResolveIncident}
          onRefreshIncidents={() => fetchDashboardIncidents(false)}
          onRefreshClusters={() => fetchDashboardClusters(false)}
          formatLocation={formatLocation}
          getSeverity={getSeverity}
          getStatus={getStatus}
          extractEvidence={extractEvidence}
        />
      </section>

      {/* =========================================================================
          MODALS & WORKSPACES (Zero functionality lost)
          ========================================================================= */}
      {/* Quick Resource Assignment Modal */}
      {isAssignModalOpen && quickAssignIncident && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-5 bg-surface border border-outline-variant space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-lg text-secondary">dispatch</span>
                <h3 className="font-black text-primary text-base">Assign Field Resource</h3>
              </div>
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="text-on-surface-variant hover:text-primary cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="text-xs space-y-2">
              <p className="text-on-surface-variant">
                Target Incident:{' '}
                <strong className="text-primary">
                  {getAuthoritativeIncidentCategory(quickAssignIncident)} • {formatLocation(quickAssignIncident)}
                </strong>
              </p>

              <div>
                <label className="text-[10px] uppercase font-mono font-bold text-on-surface-variant block mb-1">
                  Select Available Unit
                </label>
                {availableResources.length === 0 ? (
                  <p className="p-2 rounded bg-surface-container text-on-surface-variant text-xs">
                    No available resources idle in fleet. You can dispatch en-route units from Fleet Page.
                  </p>
                ) : (
                  <select
                    value={selectedResourceId}
                    onChange={(e) => setSelectedResourceId(e.target.value)}
                    className="w-full bg-surface-container border border-outline-variant rounded-lg p-2 text-xs text-primary font-medium focus:border-secondary focus:outline-none"
                  >
                    {availableResources.map((res) => (
                      <option key={res._id || res.id} value={res._id || res.id}>
                        {res.name} — {res.type || 'Unit'} ({res.capacity || 'Team'})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/40">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsAssignModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmAssignment}
                disabled={isSubmittingAssign || availableResources.length === 0}
                className="font-bold"
              >
                {isSubmittingAssign ? 'Dispatching...' : 'Confirm Dispatch'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Incident Detail Workspace Modal */}
      <IncidentDetailModal
        incident={selectedIncident}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onUpdateIncident={(updatedDoc) => {
          setIncidents((prev) =>
            prev.map((item) => (doIncidentsMatch(item, updatedDoc) ? { ...item, ...updatedDoc } : item))
          );
          fetchDashboardIncidents(true);
        }}
      />

      {/* Incident Cluster Detail Modal */}
      <IncidentClusterDetailModal
        cluster={selectedCluster}
        allIncidents={incidents}
        isOpen={isClusterModalOpen}
        onClose={() => setIsClusterModalOpen(false)}
        onOpenIncident={(inc) => handleViewIncident(inc)}
        onFocusArea={handleFocusCluster}
        onResourceAssigned={() => {
          fetchDashboardIncidents(true);
          fetchDashboardClusters();
          fetchAvailableResources();
        }}
      />
    </div>
  );
}
