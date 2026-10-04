import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { citizenApi } from '../../services/api';
import citizenSocketClient from '../../services/socketClient';
import { getLocalPackets } from '../../services/emergencyPacketManager';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { ROUTES } from '../../constants/routes';

/**
 * Format real timestamp to human-friendly local time
 * Returns null if invalid or missing (NEVER invent fake timestamps)
 */
function formatTimestamp(raw) {
  if (!raw || raw === 'Pending' || raw === 'N/A') return null;
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  } catch (_) {
    return null;
  }
}

/**
 * Format full date & time for completion receipts
 */
function formatFullDateTime(raw) {
  if (!raw) return null;
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleString([], {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch (_) {
    return null;
  }
}

export default function CitizenStatusPage() {
  const navigate = useNavigate();

  const [incidentData, setIncidentData] = useState(null);
  const [offlinePacket, setOfflinePacket] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [isLiveConnected, setIsLiveConnected] = useState(false);

  // Load the citizen's real active incident from storage or local queue
  const loadCitizenActiveIncident = useCallback(async () => {
    let storedIncident = null;
    try {
      const rawStored = localStorage.getItem('resonix_active_incident');
      if (rawStored) {
        storedIncident = JSON.parse(rawStored);
      }
    } catch (_) {}

    const lastPacketId = localStorage.getItem('resonix_last_packet_id') || storedIncident?.packetId;
    const lastClientReqId = localStorage.getItem('resonix_last_client_request_id') || storedIncident?.clientRequestId;

    // Check if there is an unsent offline packet in local queue
    try {
      const localQueue = getLocalPackets();
      const matchingLocal = localQueue.find(
        (p) => p.packetId === lastPacketId || p.clientRequestId === lastClientReqId
      );
      if (matchingLocal) {
        setOfflinePacket(matchingLocal);
        setIsLoading(false);
        setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        return;
      } else {
        setOfflinePacket(null);
      }
    } catch (_) {}

    const lookupId = storedIncident?.incidentId || lastPacketId || lastClientReqId;

    if (!lookupId) {
      setIncidentData(null);
      setIsLoading(false);
      return;
    }

    try {
      const res = await citizenApi.getEmergencyStatus(lookupId);
      const data = res?.data?.incident || res?.data?.packet || res?.data;

      if (data && (data._id || data.packetId || data.clientRequestId || data.category)) {
        setIncidentData(data);
        setErrorMessage(null);

        // Update stored cache with latest server record
        try {
          const merged = { ...storedIncident, ...data };
          localStorage.setItem('resonix_active_incident', JSON.stringify(merged));
        } catch (_) {}
      } else if (storedIncident) {
        // Fall back to stored local state
        setIncidentData(storedIncident);
      }
    } catch (err) {
      console.warn('[CitizenStatusPage] Status fetch note:', err.message);
      if (storedIncident) {
        setIncidentData(storedIncident);
        setErrorMessage('Unable to refresh. Showing your last confirmed status.');
      } else {
        setIncidentData(null);
      }
    } finally {
      setIsLoading(false);
      setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadCitizenActiveIncident();
  }, [loadCitizenActiveIncident]);

  // Real-Time Socket.IO Subscription
  useEffect(() => {
    const socket = citizenSocketClient.connect();

    const unsubscribe = citizenSocketClient.subscribe((event) => {
      if (!event) return;

      if (event.type === 'SOCKET_STATUS') {
        setIsLiveConnected(event.isConnected);
        return;
      }

      if (event.type === 'SOCKET_CONNECTED') {
        setIsLiveConnected(true);
        loadCitizenActiveIncident();
        return;
      }

      if (event.type === 'SOCKET_DISCONNECTED') {
        setIsLiveConnected(false);
        return;
      }

      // Check if event belongs to current citizen's incident
      const myIds = [
        incidentData?._id,
        incidentData?.id,
        incidentData?.incidentId,
        incidentData?.packetId,
        incidentData?.clientRequestId,
        offlinePacket?.packetId,
        offlinePacket?.clientRequestId,
      ].map((v) => (v ? String(v).trim() : '')).filter(Boolean);

      const incoming = event.incident || event.packet || event;
      const eventIds = [
        event.incidentId,
        event.packetId,
        event.clientRequestId,
        event._id,
        event.id,
        incoming?.incidentId,
        incoming?.packetId,
        incoming?.clientRequestId,
        incoming?._id,
        incoming?.id,
      ].map((v) => (v ? String(v).trim() : '')).filter(Boolean);

      const isMatching = myIds.length === 0 || eventIds.some((eId) =>
        myIds.some((mId) => eId === mId || eId.includes(mId) || mId.includes(eId))
      );

      if (isMatching || !incidentData) {
        console.log(`[CitizenStatusPage] ⚡ Received matching real-time event: ${event.type}`, event);

        if (event.type === 'SOS_CONFIRMED' || event.type === 'INCIDENT_CREATED') {
          setOfflinePacket(null);
          loadCitizenActiveIncident();
        } else if (event.type === 'INCIDENT_ACKNOWLEDGED') {
          setIncidentData((prev) => ({
            ...prev,
            acknowledgement: event.acknowledgement || {
              status: 'ACKNOWLEDGED',
              acknowledgedAt: event.timestamp || new Date().toISOString(),
              acknowledgedBy: event.responderName || 'Command Officer',
            },
          }));
          setErrorMessage(null);
        } else if (event.type === 'INCIDENT_UPDATED') {
          setIncidentData((prev) => {
            const currentStatus = String(prev?.status || '').toUpperCase();
            const newStatus = String(event.status || incoming?.status || prev?.status || '').toUpperCase();

            // Prevent race condition: do not overwrite a newer resolved/completed state with stale active data
            if (['RESOLVED', 'COMPLETED', 'CLOSED'].includes(currentStatus) && !['RESOLVED', 'COMPLETED', 'CLOSED', 'CANCELLED'].includes(newStatus)) {
              console.log('[CitizenStatusPage] Ignoring stale non-terminal status for completed incident');
              return prev;
            }

            const updated = {
              ...prev,
              ...(incoming || {}),
              status: newStatus || prev?.status,
              completedAt: event.completedAt || incoming?.completedAt || prev?.completedAt,
              completedBy: event.completedBy || incoming?.completedBy || prev?.completedBy,
              completionNotes: event.completionNotes || incoming?.completionNotes || prev?.completionNotes,
              resolutionSummary: event.resolutionSummary || incoming?.resolutionSummary || prev?.resolutionSummary,
            };
            try {
              localStorage.setItem('resonix_active_incident', JSON.stringify(updated));
            } catch (_) {}
            return updated;
          });
          setErrorMessage(null);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [incidentData, offlinePacket, loadCitizenActiveIncident]);

  // Derived Display IDs and Operational State
  const activeRecord = incidentData || offlinePacket;

  const incidentDisplayId = useMemo(() => {
    if (!activeRecord) return 'EMERGENCY';
    const idVal = activeRecord._id || activeRecord.id || activeRecord.incidentId || activeRecord.packetId || activeRecord.clientRequestId || '';
    const idStr = String(idVal);
    if (idStr.startsWith('INC-')) return idStr;
    if (idStr.length >= 4) return `INC-${idStr.slice(-4).toUpperCase()}`;
    return idStr || 'EMERGENCY';
  }, [activeRecord]);

  const rawStatus = (activeRecord?.status || activeRecord?.packetStatus || (offlinePacket ? 'QUEUED_LOCAL' : 'ACTIVE')).toUpperCase();
  const isAcknowledged = activeRecord?.acknowledgement?.status === 'ACKNOWLEDGED';
  const isDispatched = rawStatus === 'DISPATCHED' || rawStatus === 'EN_ROUTE' || Boolean(activeRecord?.assignedUnit);
  const isInProgress = rawStatus === 'IN_PROGRESS' || rawStatus === 'ON_SCENE';
  const isResolved = rawStatus === 'RESOLVED' || rawStatus === 'COMPLETED' || rawStatus === 'CLOSED' || Boolean(activeRecord?.completedAt);
  const isCancelled = rawStatus === 'CANCELLED';
  const isOfflineQueued = Boolean(offlinePacket) || rawStatus === 'QUEUED_LOCAL';

  // Determine Current Stage (0 to 5)
  const currentStageIndex = useMemo(() => {
    if (isResolved) return 5;
    if (isInProgress) return 4;
    if (isDispatched) return 3;
    if (isAcknowledged) return 2;
    if (isOfflineQueued) return 0;
    return 1; // Request Received by center
  }, [isResolved, isInProgress, isDispatched, isAcknowledged, isOfflineQueued]);

  // Status Headline & Description
  const statusHeadline = useMemo(() => {
    if (isCancelled) return 'Request cancelled';
    if (isOfflineQueued) return 'Waiting to send';
    if (isResolved) return 'Rescue completed';
    if (isInProgress) return 'Rescue in progress';
    if (isDispatched) return 'Help is on the way';
    if (isAcknowledged) return 'Responder received your request';
    return 'Emergency request active';
  }, [isCancelled, isOfflineQueued, isResolved, isInProgress, isDispatched, isAcknowledged]);

  const statusDescription = useMemo(() => {
    if (isCancelled) return 'Your emergency request was cancelled. You can return Home to submit a new emergency request if needed.';
    if (isOfflineQueued) return 'Your emergency alert is saved on this device and will be sent automatically when a connection is available.';
    if (isResolved) return 'Your emergency rescue operation has been successfully completed and confirmed.';
    if (isInProgress) return 'Emergency response team is actively conducting rescue operations on scene.';
    if (isDispatched) return `Response team has been dispatched and is currently en route to your location.`;
    if (isAcknowledged) return 'The response command center has seen your emergency request and is coordinating units.';
    return 'Your emergency request has been received by the emergency center and is under immediate review.';
  }, [isCancelled, isOfflineQueued, isResolved, isInProgress, isDispatched, isAcknowledged]);

  // Location String
  const locationText = useMemo(() => {
    if (!activeRecord) return 'Location unavailable';
    if (activeRecord.gpsCoordinates?.latitude != null) {
      return `${activeRecord.gpsCoordinates.latitude.toFixed(5)}, ${activeRecord.gpsCoordinates.longitude.toFixed(5)}`;
    }
    if (activeRecord.location?.lat != null) {
      return `${activeRecord.location.lat.toFixed(5)}, ${activeRecord.location.lng.toFixed(5)}`;
    }
    if (activeRecord.location?.latitude != null) {
      return `${activeRecord.location.latitude.toFixed(5)}, ${activeRecord.location.longitude.toFixed(5)}`;
    }
    if (typeof activeRecord.location === 'string' && activeRecord.location.trim()) {
      return activeRecord.location;
    }
    if (activeRecord.sector) {
      return activeRecord.sector;
    }
    return 'Location unavailable';
  }, [activeRecord]);

  // Category
  const categoryText = (
    activeRecord?.category ||
    activeRecord?.selectedCategory ||
    activeRecord?.citizenInput?.selectedCategory ||
    'EMERGENCY'
  ).toUpperCase();

  // Structured AI Incident Triage Data & Original Citizen Evidence
  const originalEvidence = useMemo(() => {
    return activeRecord?.originalCitizenEvidence || {
      rawText: activeRecord?.description || activeRecord?.message || activeRecord?.emergencyText || activeRecord?.voiceTranscript || '',
      selectedCategory: activeRecord?.selectedCategory || activeRecord?.citizenInput?.selectedCategory || activeRecord?.category || 'Emergency',
      voiceTranscript: activeRecord?.voiceTranscript || null,
      photoReference: activeRecord?.photoReference || (activeRecord?.image ? { dataUrl: activeRecord?.image } : null),
      gpsCoordinates: activeRecord?.gpsCoordinates || activeRecord?.location || null,
      submittedAt: activeRecord?.timestamp || activeRecord?.createdAt || null,
    };
  }, [activeRecord]);

  const aiTriage = activeRecord?.aiTriage || null;
  const canonicalCategory = aiTriage?.category || (activeRecord?.category ? String(activeRecord.category).replace(/_/g, ' ') : 'General Emergency');
  const triageSeverity = aiTriage?.severity || activeRecord?.severity || 'High';
  const confidenceScore = aiTriage?.confidence?.score ?? (activeRecord?.confidence != null ? (activeRecord.confidence <= 1 ? activeRecord.confidence : activeRecord.confidence / 100) : 0.88);
  const confidencePct = Math.round(confidenceScore * 100);
  const confidenceLevel = aiTriage?.confidence?.level || (confidenceScore >= 0.85 ? 'HIGH' : confidenceScore >= 0.65 ? 'MEDIUM' : 'LOW');
  const extractedEntities = aiTriage?.extractedEntities || activeRecord?.extractedEntities || null;

  // Clear Completed Request to Start Fresh
  const handleStartNewReport = () => {
    try {
      localStorage.removeItem('resonix_active_incident');
      localStorage.removeItem('resonix_last_packet_id');
      localStorage.removeItem('resonix_last_client_request_id');
    } catch (_) {}
    setIncidentData(null);
    setOfflinePacket(null);
    navigate(ROUTES.CITIZEN_HOME);
  };

  // 6 Timeline Milestones with Real Timestamps ONLY
  const timelineStages = useMemo(() => {
    const sentTime = formatTimestamp(activeRecord?.timestamp || activeRecord?.createdAt);
    const receivedTime = formatTimestamp(activeRecord?.responseLifecycle?.receivedAt || activeRecord?.createdAt);
    const ackTime = formatTimestamp(activeRecord?.acknowledgement?.acknowledgedAt);
    const dispatchTime = formatTimestamp(activeRecord?.responseLifecycle?.dispatchTime || activeRecord?.deployedAt || activeRecord?.assignedAt);
    const inProgressTime = formatTimestamp(activeRecord?.inProgressAt || (isInProgress ? activeRecord?.updatedAt : null));
    const completedTime = formatTimestamp(activeRecord?.completedAt || activeRecord?.responseLifecycle?.resolvedAt);

    return [
      {
        index: 0,
        title: isOfflineQueued ? 'SOS Saved (Offline)' : 'SOS Sent',
        description: isOfflineQueued ? 'Saved on device. Will send automatically.' : 'Your emergency request was sent from this device.',
        timestamp: sentTime,
        isCompleted: !isOfflineQueued && currentStageIndex >= 0,
        isCurrent: isOfflineQueued,
      },
      {
        index: 1,
        title: 'Request Received',
        description: 'Emergency center received your request.',
        timestamp: !isOfflineQueued ? receivedTime : null,
        isCompleted: !isOfflineQueued && currentStageIndex >= 1,
        isCurrent: !isOfflineQueued && currentStageIndex === 1,
      },
      {
        index: 2,
        title: 'Responder Notified',
        description: 'Your request has been seen by the response team.',
        timestamp: isAcknowledged ? ackTime : null,
        isCompleted: currentStageIndex >= 2,
        isCurrent: currentStageIndex === 2,
      },
      {
        index: 3,
        title: 'Help on the Way',
        description: activeRecord?.assignedUnit
          ? `Dispatched: ${activeRecord.assignedUnit}`
          : 'Response team is being dispatched.',
        timestamp: isDispatched ? dispatchTime : null,
        isCompleted: currentStageIndex >= 3,
        isCurrent: currentStageIndex === 3,
      },
      {
        index: 4,
        title: 'Rescue in Progress',
        description: 'Response team is actively assisting on scene.',
        timestamp: isInProgress || isResolved ? inProgressTime : null,
        isCompleted: currentStageIndex >= 4,
        isCurrent: currentStageIndex === 4,
      },
      {
        index: 5,
        title: 'Rescue Completed',
        description: isResolved ? 'Emergency response verified and completed.' : 'Waiting for rescue completion.',
        timestamp: isResolved ? completedTime : null,
        isCompleted: isResolved,
        isCurrent: isResolved,
      },
    ];
  }, [activeRecord, currentStageIndex, isOfflineQueued, isAcknowledged, isDispatched, isInProgress, isResolved]);

  // Loading Skeleton State
  if (isLoading) {
    return (
      <div className="w-full py-4 sm:py-6 space-y-4 text-left animate-fade-in pb-12">
        <div className="flex items-center justify-between border-b border-outline-variant/60 pb-3">
          <div>
            <h1 className="text-xl font-black text-primary">Emergency Status</h1>
            <p className="text-[11px] text-on-surface-variant">Checking emergency status...</p>
          </div>
        </div>
        <Card className="p-8 text-center space-y-3 border border-outline-variant/60">
          <div className="w-8 h-8 mx-auto border-3 border-secondary border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-on-surface-variant font-medium">Connecting to emergency system...</p>
        </Card>
      </div>
    );
  }

  // Authoritative Empty State (No Active Emergency)
  if (!activeRecord) {
    return (
      <div className="w-full py-4 sm:py-6 space-y-4 text-left animate-fade-in pb-12">
        <div className="flex items-center justify-between border-b border-outline-variant/60 pb-3">
          <div>
            <h1 className="text-xl font-black text-primary">Emergency Status</h1>
            <p className="text-[11px] text-on-surface-variant">Live response tracking</p>
          </div>
        </div>

        <Card className="p-8 text-center space-y-4 border border-outline-variant/60 shadow-sm">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-surface-container flex items-center justify-center text-on-surface-variant">
            <span className="material-symbols-outlined text-3xl">verified_user</span>
          </div>

          <div className="space-y-1 max-w-sm mx-auto">
            <h2 className="text-base font-extrabold text-primary">No Active Emergency</h2>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              You do not have an active emergency request.
            </p>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Send an SOS from the Home screen if you need emergency assistance.
            </p>
          </div>

          <div className="pt-2">
            <Button
              variant="urgent"
              size="md"
              icon="sos"
              onClick={() => navigate(ROUTES.CITIZEN_HOME)}
              className="font-extrabold px-6 shadow-md"
            >
              Go to Emergency Home
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full py-4 sm:py-6 space-y-4 text-left animate-fade-in pb-12">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/60 pb-3">
        <div>
          <h1 className="text-xl font-black text-primary leading-tight">Emergency Status</h1>
          <p className="text-[11px] text-on-surface-variant">Live Response Tracking</p>
        </div>

        <div className="flex items-center gap-1.5 bg-surface-container px-3 py-1 rounded-full border border-outline-variant text-[10px] font-mono shrink-0">
          <span className={`w-2 h-2 rounded-full ${isLiveConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          <span className="text-on-surface-variant font-bold">
            {isLiveConnected ? 'Live Connection Active' : 'Connecting...'} {lastSyncTime && `• ${lastSyncTime}`}
          </span>
        </div>
      </div>

      {/* Error Fallback Banner */}
      {errorMessage && (
        <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-700 text-xs font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-base shrink-0">info</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Top Emergency Information Card */}
      <Card
        className={`p-5 border-2 shadow-lg space-y-3.5 ${
          isCancelled
            ? 'border-outline-variant/80 bg-surface-container/60'
            : isResolved
            ? 'border-emerald-500/40 bg-emerald-500/5'
            : isOfflineQueued
            ? 'border-amber-500/40 bg-amber-500/5'
            : 'border-secondary/40 bg-gradient-to-b from-surface to-surface-container'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/40 pb-2.5">
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-mono font-black px-2.5 py-0.5 rounded-md border ${
                isCancelled
                  ? 'bg-surface-container-high text-on-surface-variant border-outline-variant'
                  : isResolved
                  ? 'bg-emerald-500/20 text-emerald-700 border-emerald-500/40'
                  : 'bg-secondary/20 text-secondary border-secondary/40'
              }`}
            >
              {incidentDisplayId}
            </span>
            <span className="text-xs font-black text-primary uppercase">{categoryText}</span>
          </div>

          <span
            className={`text-[10px] font-mono font-extrabold px-2.5 py-0.5 rounded-full ${
              isCancelled
                ? 'bg-surface-container-highest text-on-surface-variant'
                : isResolved
                ? 'bg-emerald-600 text-white'
                : isOfflineQueued
                ? 'bg-amber-500 text-white'
                : 'bg-secondary text-white'
            }`}
          >
            {statusHeadline.toUpperCase()}
          </span>
        </div>

        {/* Status Headline Banner */}
        <div className="space-y-1">
          <h2 className="text-lg font-black text-primary leading-tight flex items-center gap-2">
            {isCancelled ? (
              <span className="material-symbols-outlined text-on-surface-variant text-2xl shrink-0">cancel</span>
            ) : isResolved ? (
              <span className="material-symbols-outlined text-emerald-600 text-2xl shrink-0">check_circle</span>
            ) : isOfflineQueued ? (
              <span className="material-symbols-outlined text-amber-500 text-2xl shrink-0">wifi_off</span>
            ) : (
              <span className="material-symbols-outlined text-secondary text-2xl shrink-0">crisis_alert</span>
            )}
            <span>{statusHeadline}</span>
          </h2>
          <p className="text-xs text-on-surface-variant font-medium leading-relaxed">{statusDescription}</p>
        </div>

        {/* Incident Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 text-xs border-t border-outline-variant/40">
          <div className="p-2.5 rounded-xl bg-surface-container/60 border border-outline-variant/30 space-y-0.5">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">
              Reported Time
            </span>
            <span className="font-mono text-primary font-bold block">
              {formatFullDateTime(activeRecord.timestamp || activeRecord.createdAt) || 'Recent'}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-surface-container/60 border border-outline-variant/30 space-y-0.5">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">
              Location
            </span>
            <span className="font-mono text-primary font-bold truncate block">
              {locationText}
            </span>
          </div>
        </div>

        {/* Responder / Squad Information (Real data only) */}
        <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-base">shield_person</span>
            <div>
              <span className="text-[10px] font-bold text-on-surface-variant uppercase block">Response Team</span>
              <span className="font-extrabold text-primary block">
                {activeRecord.assignedUnit || 'Response team will be assigned shortly'}
              </span>
            </div>
          </div>

          {activeRecord.etaMinutes != null && !isResolved && (
            <div className="text-right">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase block">Estimated Arrival</span>
              <span className="font-mono text-xs font-black text-secondary">
                {activeRecord.etaMinutes} min(s)
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* AI-Assisted Incident Triage & Evidence Record */}
      <Card className="p-4 sm:p-5 border-2 border-secondary/30 bg-surface space-y-4 shadow-md text-left">
        {/* Header with Title and Assistant Badge */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/60 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary border border-secondary/30">
              <span className="material-symbols-outlined text-lg">psychology</span>
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black text-primary uppercase tracking-wider flex items-center gap-1.5">
                <span>AI-Assisted Emergency Incident Triage</span>
              </h3>
              <p className="text-[10px] text-on-surface-variant font-medium">
                Structured Ingestion &bull; Original Citizen Evidence vs. AI Classification
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/10 text-secondary border border-secondary/30 text-[10px] font-bold">
            <span className="material-symbols-outlined text-xs animate-pulse">auto_awesome</span>
            <span>{confidencePct}% AI Confidence</span>
          </div>
        </div>

        {/* Mandatory Advisory Notice: Not an official emergency determination */}
        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-[11px] leading-relaxed flex items-start gap-2">
          <span className="material-symbols-outlined text-sm shrink-0 mt-0.5 text-amber-600">gavel</span>
          <div>
            <span className="font-extrabold uppercase tracking-wide block text-[10px]">
              Advisory Decision-Support Only — Not an Official Determination
            </span>
            <span>
              AI-derived classification and confidence scores are automated triage indicators for emergency responders. Official incident prioritization and emergency response decisions are authorized solely by human emergency personnel.
            </span>
          </div>
        </div>

        {/* Dual Panel Comparison: Original Citizen Evidence vs AI Classification */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* Panel 1: Original Citizen Evidence (Unaltered, Pristine) */}
          <div className="p-3.5 rounded-xl bg-surface-container/60 border border-outline-variant/60 space-y-2.5 relative">
            <div className="flex items-center justify-between border-b border-outline-variant/40 pb-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-xs text-amber-600">lock</span>
                <span>Original Citizen Report (Unaltered)</span>
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-surface border border-outline-variant text-on-surface-variant font-bold">
                Pristine Input
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div>
                <span className="text-[10px] font-bold text-on-surface-variant uppercase block">Citizen Selected Category:</span>
                <span className="font-bold text-primary text-xs bg-surface px-2 py-0.5 rounded border border-outline-variant/50 inline-block mt-0.5">
                  {originalEvidence.selectedCategory || 'Emergency'}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-on-surface-variant uppercase block">Submitted Statement / Description:</span>
                <p className="text-xs text-primary font-medium bg-surface p-2 rounded-lg border border-outline-variant/40 italic leading-relaxed whitespace-pre-wrap">
                  "{originalEvidence.rawText || originalEvidence.voiceTranscript || 'No text description entered'}"
                </p>
              </div>

              {originalEvidence.voiceTranscript && (
                <div>
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">mic</span>
                    <span>Voice Transcript:</span>
                  </span>
                  <p className="text-[11px] text-primary bg-surface p-1.5 rounded border border-outline-variant/40">
                    "{originalEvidence.voiceTranscript}"
                  </p>
                </div>
              )}

              {originalEvidence.photoReference?.dataUrl && (
                <div>
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">photo_camera</span>
                    <span>Uploaded Scene Evidence:</span>
                  </span>
                  <div className="mt-1 w-24 h-16 rounded-lg overflow-hidden border border-outline-variant/60 bg-black/5 flex items-center justify-center">
                    <img
                      src={originalEvidence.photoReference.dataUrl}
                      alt="Citizen evidence photo"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}

              <div className="pt-1 text-[10px] font-mono text-on-surface-variant border-t border-outline-variant/30 flex items-center justify-between">
                <span>Submitted:</span>
                <span>{formatFullDateTime(originalEvidence.submittedAt || activeRecord.timestamp) || 'Confirmed'}</span>
              </div>
            </div>
          </div>

          {/* Panel 2: AI Classification & Confidence (AI-Derived) */}
          <div className="p-3.5 rounded-xl bg-gradient-to-br from-secondary/5 via-surface to-secondary/10 border-2 border-secondary/30 space-y-2.5 relative">
            <div className="flex items-center justify-between border-b border-secondary/20 pb-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-secondary flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">bolt</span>
                <span>AI Classification & Confidence</span>
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-secondary/15 text-secondary border border-secondary/30 font-bold">
                AI-Derived
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase block">Canonical AI Category:</span>
                  <span className="text-sm font-black text-secondary uppercase tracking-tight flex items-center gap-1 mt-0.5">
                    <span className="material-symbols-outlined text-base">emergency</span>
                    <span>{canonicalCategory}</span>
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase block">Severity:</span>
                  <span
                    className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-full border inline-block mt-0.5 ${
                      String(triageSeverity).toUpperCase() === 'CRITICAL'
                        ? 'bg-red-500/20 text-red-700 border-red-500/40'
                        : String(triageSeverity).toUpperCase() === 'HIGH'
                        ? 'bg-amber-500/20 text-amber-800 border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-800 border-emerald-500/40'
                    }`}
                  >
                    {String(triageSeverity).toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Confidence Progress Meter */}
              <div className="space-y-1 bg-surface p-2 rounded-lg border border-secondary/20">
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className="text-on-surface-variant uppercase">AI Confidence Score:</span>
                  <span className="text-secondary font-mono font-black">{confidencePct}% ({confidenceLevel})</span>
                </div>
                <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden border border-outline-variant/40">
                  <div
                    className="h-full bg-gradient-to-r from-secondary to-indigo-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(10, confidencePct))}%` }}
                  />
                </div>
              </div>

              {/* Extracted Entities Grid */}
              {extractedEntities && (
                <div className="space-y-1 pt-1">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase block">Extracted Incident Entities:</span>
                  <div className="flex flex-wrap gap-1">
                    {extractedEntities.peopleAffected != null && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface border border-outline-variant/60 text-primary">
                        👥 People: {extractedEntities.peopleAffected}
                      </span>
                    )}
                    {extractedEntities.trappedPersons != null && extractedEntities.trappedPersons > 0 && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/15 border border-red-500/40 text-red-700 font-bold">
                        ⚠️ Trapped: {extractedEntities.trappedPersons}
                      </span>
                    )}
                    {Array.isArray(extractedEntities.hazards) && extractedEntities.hazards.length > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-800">
                        ⚡ {extractedEntities.hazards.slice(0, 2).join(', ')}
                      </span>
                    )}
                    {Array.isArray(extractedEntities.medicalNeeds) && extractedEntities.medicalNeeds.length > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/15 border border-rose-500/40 text-rose-700">
                        🩹 {extractedEntities.medicalNeeds.slice(0, 2).join(', ')}
                      </span>
                    )}
                    {Array.isArray(extractedEntities.landmarks) && extractedEntities.landmarks.length > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-surface border border-outline-variant text-on-surface-variant">
                        📍 {extractedEntities.landmarks.slice(0, 2).join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Vertical Status Timeline (6 Stages) */}
      <Card className="p-5 border border-outline-variant/60 shadow-md space-y-4">
        <div className="flex items-center justify-between border-b border-outline-variant/60 pb-2">
          <h3 className="text-xs font-black text-primary uppercase tracking-wider flex items-center gap-1.5">
            <span className="material-symbols-outlined text-secondary text-base">timeline</span>
            <span>Response Timeline</span>
          </h3>

          <span className="text-[10px] font-mono text-on-surface-variant">
            Stage {Math.min(currentStageIndex + 1, 6)} of 6
          </span>
        </div>

        <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-outline-variant">
          {timelineStages.map((stage) => {
            return (
              <div key={stage.index} className="relative text-xs">
                {/* Timeline Marker */}
                <div
                  className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs transition-all ${
                    stage.isCompleted
                      ? 'bg-emerald-600 text-white ring-4 ring-emerald-600/20'
                      : stage.isCurrent
                      ? 'bg-secondary text-white ring-4 ring-secondary/30 animate-pulse font-black'
                      : 'bg-surface-container border border-outline text-on-surface-variant/40'
                  }`}
                >
                  {stage.isCompleted ? (
                    <span className="material-symbols-outlined text-xs font-black">check</span>
                  ) : stage.isCurrent ? (
                    <span className="w-2 h-2 rounded-full bg-white" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-outline" />
                  )}
                </div>

                {/* Stage Info */}
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <h4
                      className={`text-xs ${
                        stage.isCompleted
                          ? 'font-extrabold text-emerald-700 dark:text-emerald-400'
                          : stage.isCurrent
                          ? 'font-black text-secondary'
                          : 'font-semibold text-on-surface-variant/60'
                      }`}
                    >
                      {stage.title}
                    </h4>

                    {stage.timestamp && (
                      <span className="text-[10px] font-mono text-on-surface-variant shrink-0">
                        {stage.timestamp}
                      </span>
                    )}
                  </div>

                  <p
                    className={`text-[11px] leading-relaxed ${
                      stage.isCompleted || stage.isCurrent
                        ? 'text-on-surface-variant font-medium'
                        : 'text-on-surface-variant/50'
                    }`}
                  >
                    {stage.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Completed Mission Resolution Banner & Start New Report Action */}
      {isResolved && (
        <Card className="p-4 border border-emerald-500/40 bg-emerald-500/10 space-y-3 text-left animate-fade-in shadow-sm">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
            <span className="material-symbols-outlined text-xl">task_alt</span>
            <div>
              <h3 className="text-sm font-black leading-tight">Emergency Request Completed</h3>
              <p className="text-[11px]">
                Completed on {formatFullDateTime(activeRecord.completedAt) || 'Today'}
              </p>
            </div>
          </div>

          {activeRecord.resolutionSummary && (
            <p className="text-xs text-primary bg-surface p-3 rounded-xl border border-outline-variant/60 font-medium">
              "{activeRecord.resolutionSummary}"
            </p>
          )}

          <div className="pt-1 flex items-center justify-end">
            <Button
              variant="secondary"
              size="sm"
              icon="add_circle"
              onClick={handleStartNewReport}
              className="text-xs font-extrabold px-4"
            >
              Start New Emergency Report
            </Button>
          </div>
        </Card>
      )}

      {/* Cancelled Banner & Start New Report Action */}
      {isCancelled && (
        <Card className="p-4 border border-outline-variant/60 bg-surface-container space-y-3 text-left animate-fade-in shadow-sm">
          <div className="flex items-center gap-2 text-primary">
            <span className="material-symbols-outlined text-xl text-on-surface-variant">cancel</span>
            <div>
              <h3 className="text-sm font-black leading-tight">Emergency Request Cancelled</h3>
              <p className="text-[11px] text-on-surface-variant">
                This emergency alert was cancelled.
              </p>
            </div>
          </div>

          <div className="pt-1 flex items-center justify-end">
            <Button
              variant="secondary"
              size="sm"
              icon="add_circle"
              onClick={handleStartNewReport}
              className="text-xs font-extrabold px-4"
            >
              Start New Emergency Report
            </Button>
          </div>
        </Card>
      )}

      {/* Citizen Guidance Footer Notes */}
      <Card className="p-4 border border-outline-variant/60 bg-surface-container/40 space-y-2 text-xs">
        <div className="flex items-center gap-1.5 font-bold text-primary">
          <span className="material-symbols-outlined text-secondary text-base">info</span>
          <span>Emergency Assistance Information</span>
        </div>
        <p className="text-[11px] text-on-surface-variant leading-relaxed">
          Keep your device powered on and stay in a secure location. Responders receive real-time updates directly from this session.
        </p>
        <div className="pt-1 flex items-center justify-between">
          <a
            href="tel:112"
            className="text-[11px] font-bold text-error bg-error/10 hover:bg-error/20 px-3 py-1 rounded-lg border border-error/30 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-xs">call</span>
            <span>Emergency Helpline 112</span>
          </a>

          <Button
            variant="ghost"
            size="sm"
            onClick={loadCitizenActiveIncident}
            className="text-[11px] font-bold text-secondary flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-xs">refresh</span>
            <span>Refresh Status</span>
          </Button>
        </div>
      </Card>
    </div>
  );
}
