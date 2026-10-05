import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { citizenApi } from '../../services/api';
import { transmitPacketToBackend, removeLocalPacket, getLocalPackets } from '../../services/emergencyPacketManager';
import { offlineCommunicationService } from '../../services/offlineCommunicationService';
import LocationDetectorWidget from '../../components/location/LocationDetectorWidget';
import NetworkStatusWidget from '../../components/network/NetworkStatusWidget';
import EmergencyAcknowledgementModal, { isIncidentAcknowledged, markIncidentAcknowledged } from '../../components/emergency/EmergencyAcknowledgementModal';
import { citizenSocketClient } from '../../services/socketClient';
import LiveWeatherCard from '../../components/cards/LiveWeatherCard';
import ExtremeWeatherAlertBanner from '../../components/alerts/ExtremeWeatherAlertBanner';
import Card from '../../components/ui/Card';

// Helper to retrieve the current active incident from localStorage or local offline queue
const getStoredActiveIncident = () => {
  let stored = null;
  try {
    const raw = localStorage.getItem('resonix_active_incident');
    if (raw) {
      stored = JSON.parse(raw);
    }
  } catch (_) {}

  // If status in stored incident is terminal (resolved, completed, closed, cancelled), do not treat as active
  if (stored) {
    const s = String(stored.status || '').toUpperCase();
    if (s === 'RESOLVED' || s === 'COMPLETED' || s === 'CLOSED' || s === 'CANCELLED') {
      return null;
    }
    if (stored.packetId || stored.clientRequestId || stored.incidentId) {
      return stored;
    }
  }

  // Check if there is an unsent offline packet in local queue
  try {
    const lastPacketId = localStorage.getItem('resonix_last_packet_id');
    const lastClientReqId = localStorage.getItem('resonix_last_client_request_id');
    const localQueue = getLocalPackets();
    if (Array.isArray(localQueue) && localQueue.length > 0) {
      const matchingLocal = localQueue.find(
        (p) => p.packetId === lastPacketId || p.clientRequestId === lastClientReqId
      ) || localQueue[0];
      if (matchingLocal) {
        return {
          packetId: matchingLocal.packetId,
          clientRequestId: matchingLocal.clientRequestId,
          incidentId: matchingLocal.packetId,
          category: matchingLocal.category || 'EMERGENCY',
          location: matchingLocal.gpsCoordinates?.latitude != null
            ? `GPS: ${matchingLocal.gpsCoordinates.latitude.toFixed(4)}, ${matchingLocal.gpsCoordinates.longitude.toFixed(4)}`
            : 'Live Telemetry Sector',
          gpsCoordinates: matchingLocal.gpsCoordinates,
          timestamp: matchingLocal.timestamp || new Date().toISOString(),
          offline: true,
          status: 'QUEUED_LOCAL',
        };
      }
    }
  } catch (_) {}

  return null;
};

export default function CitizenHomePage() {
  const { citizenUser, isCitizenGuest, guestId } = useAuth();
  const { settings, sosCountdownSeconds } = useSettings();

  const initialActiveIncident = getStoredActiveIncident();

  // Emergency States
  // 'IDLE' | 'DISPATCHED' | 'CANCELLING'
  const [sosState, setSosState] = useState(() => (
    initialActiveIncident ? 'DISPATCHED' : 'IDLE'
  ));
  const [lastSubmittedPacket, setLastSubmittedPacket] = useState(() => initialActiveIncident);
  const [clientRequestId, setClientRequestId] = useState(() => (
    initialActiveIncident?.clientRequestId || initialActiveIncident?.packetId || null
  ));
  const [sosTimer, setSosTimer] = useState(() => {
    if (initialActiveIncident?.timestamp) {
      const elapsed = Math.floor((Date.now() - new Date(initialActiveIncident.timestamp).getTime()) / 1000);
      return elapsed > 0 ? elapsed : 0;
    }
    return 0;
  });
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [completedNotice, setCompletedNotice] = useState(null);

  // Performance & Non-UI State Refs
  const lastSubmittedPacketRef = useRef(lastSubmittedPacket);
  const clientRequestIdRef = useRef(null);
  const sosDispatchIntervalRef = useRef(null);
  const toastTimerRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    lastSubmittedPacketRef.current = lastSubmittedPacket;
  }, [lastSubmittedPacket]);

  // Audio Emergency Chime Tone
  const playEmergencyTone = () => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const audioCtx = new AudioContextClass();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch (_) {}
  };

  // Citizen Acknowledgement Modal State
  const [acknowledgementData, setAcknowledgementData] = useState(null);
  const [showAcknowledgementModal, setShowAcknowledgementModal] = useState(false);

  // SOS Dispatch Timer Effect
  useEffect(() => {
    if (sosDispatchIntervalRef.current) clearInterval(sosDispatchIntervalRef.current);
    if (sosState === 'DISPATCHED') {
      sosDispatchIntervalRef.current = setInterval(() => {
        setSosTimer((prev) => prev + 1);
      }, 1000);
    } else if (sosState !== 'DISPATCHED') {
      // Only reset timer when not dispatched
      if (sosState === 'IDLE') setSosTimer(0);
    }
    return () => {
      if (sosDispatchIntervalRef.current) clearInterval(sosDispatchIntervalRef.current);
    };
  }, [sosState]);

  const [acknowledgementState, setAcknowledgementState] = useState({ status: 'UNACKNOWLEDGED' });
  const [isStatusChanging, setIsStatusChanging] = useState(false);
  const prevAckStatusRef = useRef(acknowledgementState?.status);

  useEffect(() => {
    if (prevAckStatusRef.current !== acknowledgementState?.status) {
      prevAckStatusRef.current = acknowledgementState?.status;
      setIsStatusChanging(true);
      const timer = setTimeout(() => setIsStatusChanging(false), 450);
      return () => clearTimeout(timer);
    }
  }, [acknowledgementState?.status]);

  useEffect(() => {
    clientRequestIdRef.current = clientRequestId;
  }, [clientRequestId]);

  // Refresh safety: Query real status from backend on mount, packet update, and periodic polling while dispatched
  useEffect(() => {
    let isMounted = true;
    const activeId = lastSubmittedPacket?.incidentId || lastSubmittedPacket?.packetId || lastSubmittedPacket?.clientRequestId || clientRequestId;
    if (activeId && sosState === 'DISPATCHED') {
      const checkStatus = () => {
        citizenApi.getEmergencyStatus(activeId)
          .then((res) => {
            if (!isMounted) return;
            const pkt = res?.packet || res?.data?.packet || res?.data?.incident || res?.data;
            if (pkt) {
              const srvStatus = String(pkt.status || '').toUpperCase();
              if (srvStatus === 'RESOLVED' || srvStatus === 'COMPLETED' || srvStatus === 'CLOSED' || srvStatus === 'CANCELLED') {
                const completedTime = pkt.completedAt || new Date().toISOString();
                const resolutionNotes = pkt.resolutionSummary || pkt.completionNotes || 'Emergency resolved by response unit';
                try {
                  const currentStored = JSON.parse(localStorage.getItem('resonix_active_incident') || '{}');
                  const updatedStored = {
                    ...currentStored,
                    status: srvStatus,
                    completedAt: completedTime,
                    completedBy: pkt.completedBy || 'Command Officer',
                    completionNotes: resolutionNotes,
                    resolutionSummary: resolutionNotes,
                  };
                  localStorage.setItem('resonix_active_incident', JSON.stringify(updatedStored));
                } catch (_) {}
                if (srvStatus === 'RESOLVED' || srvStatus === 'COMPLETED') {
                  setCompletedNotice({
                    status: srvStatus,
                    completedAt: completedTime,
                    resolutionSummary: resolutionNotes,
                  });
                }
                setSosState('IDLE');
                setLastSubmittedPacket(null);
                setClientRequestId(null);
                setSosTimer(0);
                setToastMessage(`✓ Emergency alert ${srvStatus.toLowerCase()} by response team. Ready for new report.`);
                return;
              }

              if (pkt.acknowledgement) {
                setAcknowledgementState(pkt.acknowledgement);
              }

              // Sync localStorage cache with authoritative server record
              try {
                const currentStored = JSON.parse(localStorage.getItem('resonix_active_incident') || '{}');
                localStorage.setItem('resonix_active_incident', JSON.stringify({ ...currentStored, ...pkt }));
              } catch (_) {}
            }
          })
          .catch(() => {});
      };

      checkStatus();
      const pollInterval = setInterval(checkStatus, 8000);
      return () => {
        isMounted = false;
        clearInterval(pollInterval);
      };
    }
    return () => { isMounted = false; };
  }, [lastSubmittedPacket, clientRequestId, sosState]);

  // Real-time Socket.IO listener for responder acknowledgement and status updates
  useEffect(() => {
    try {
      const userId = isCitizenGuest ? guestId || 'usr_guest' : citizenUser?.id || 'usr_citizen';
      citizenSocketClient.connect(userId);

      const unsubscribe = citizenSocketClient.onEvent((event) => {
        if (!event || !event.type) return;

        const isAckEvent = event.type === 'INCIDENT_ACKNOWLEDGED' || event.type === 'INCIDENT_UPDATED' || event.type === 'SOS_CONFIRMED';
        if (!isAckEvent) return;

        const incoming = event.incident || event.packet || event;
        const incomingAck = incoming?.acknowledgement || event.acknowledgement;
        const incomingStatus = String(incoming?.status || event.status || '').toUpperCase();

        const curPacket = lastSubmittedPacketRef.current;
        const curReqId = clientRequestIdRef.current;
        let storedActive = null;
        try {
          storedActive = JSON.parse(localStorage.getItem('resonix_active_incident') || '{}');
        } catch (_) {}

        const myIds = [
          curPacket?.clientRequestId,
          curPacket?.packetId,
          curPacket?.incidentId,
          curPacket?._id,
          storedActive?.clientRequestId,
          storedActive?.packetId,
          storedActive?.incidentId,
          storedActive?._id,
          curReqId,
        ].map((v) => (v ? String(v).trim() : '')).filter(Boolean);

        if (myIds.length > 0) {
          const incIds = [
            event.clientRequestId,
            event.packetId,
            event.incidentId,
            event._id,
            event.id,
            incoming.clientRequestId,
            incoming.packetId,
            incoming.incidentId,
            incoming._id,
            incoming.id,
          ].map((v) => (v ? String(v).trim() : '')).filter(Boolean);

          const isMatch = myIds.some((myId) =>
            incIds.some((id) => id === myId || id.includes(myId) || myId.includes(id) || (id.length >= 6 && myId.length >= 6 && (id.endsWith(myId) || myId.endsWith(id))))
          );

          if (isMatch) {
            // Check for terminal status update (RESOLVED, COMPLETED, CLOSED, CANCELLED)
            if (['RESOLVED', 'COMPLETED', 'CLOSED', 'CANCELLED'].includes(incomingStatus)) {
              console.log('CITIZEN: TERMINAL STATUS RECEIVED', incomingStatus);
              const completedTime = incoming?.completedAt || event.completedAt || new Date().toISOString();
              const resolutionNotes = incoming?.resolutionSummary || incoming?.completionNotes || event.resolutionSummary || event.completionNotes || 'Emergency resolved by response unit';
              try {
                const currentStored = JSON.parse(localStorage.getItem('resonix_active_incident') || '{}');
                const updatedStored = {
                  ...currentStored,
                  status: incomingStatus,
                  completedAt: completedTime,
                  completedBy: incoming?.completedBy || event.completedBy || 'Command Officer',
                  completionNotes: resolutionNotes,
                  resolutionSummary: resolutionNotes,
                };
                localStorage.setItem('resonix_active_incident', JSON.stringify(updatedStored));
              } catch (_) {}
              if (incomingStatus === 'RESOLVED' || incomingStatus === 'COMPLETED') {
                setCompletedNotice({
                  status: incomingStatus,
                  completedAt: completedTime,
                  resolutionSummary: resolutionNotes,
                });
              }
              setSosState('IDLE');
              setLastSubmittedPacket(null);
              setClientRequestId(null);
              setSosTimer(0);
              setToastMessage(`✓ Emergency alert ${incomingStatus.toLowerCase()} by response team. Home is ready for a new report.`);
              return;
            }

            if (incomingAck) {
              console.log('CITIZEN: ACK RECEIVED', myId);
              setAcknowledgementState(incomingAck);
              console.log('CITIZEN: ACK STATE UPDATED', incomingAck);

              if (incomingAck.status === 'ACKNOWLEDGED') {
                setToastMessage('✓ Response Team Has Seen Your Alert');
                if (!isIncidentAcknowledged(myId)) {
                  markIncidentAcknowledged(myId);
                  setAcknowledgementData({
                    alertId: myId,
                    status: 'ACTIVE',
                    location: curPacket?.gpsCoordinates?.latitude != null
                      ? `GPS: ${curPacket.gpsCoordinates.latitude.toFixed(4)}, ${curPacket.gpsCoordinates.longitude.toFixed(4)}`
                      : 'Live Telemetry Sector',
                    category: curPacket?.category || 'EMERGENCY',
                  });
                  setShowAcknowledgementModal(true);
                }
              }
            }
          }
        }
      });

      return () => {
        if (unsubscribe) unsubscribe();
      };
    } catch (err) {
      console.error('[CitizenHomePage] Socket listener error:', err);
    }
  }, [isCitizenGuest, guestId, citizenUser]);

  // Clean up timeouts on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (sosDispatchIntervalRef.current) clearInterval(sosDispatchIntervalRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Cancel SOS request
  const handleCancelRequest = async () => {
    if (isCancelling) return;
    setIsCancelling(true);
    setShowCancelConfirm(false);
    setSosState('CANCELLING');

    const targetPacketId = lastSubmittedPacket?.incidentId || lastSubmittedPacket?._id || lastSubmittedPacket?.packetId || clientRequestId;

    try {
      // Use existing PUT /api/v1/incidents/:id to update status to 'cancelled'
      if (targetPacketId) {
        await citizenApi.cancelSOS(targetPacketId);
      }
    } catch (err) {
      // Even if backend call fails (e.g. no matching DB record), proceed with client-side cancellation
      console.warn('[CitizenHomePage] Cancel API call failed (non-blocking):', err.message);
    }

    // Immediately remove from local offline & relay queues so background loop never re-uploads
    if (targetPacketId) {
      removeLocalPacket(targetPacketId);
      if (offlineCommunicationService) {
        offlineCommunicationService.updateMessageStatus(targetPacketId, 'CANCELLED');
        offlineCommunicationService.removeMessage(targetPacketId);
      }
    }

    // Clear active incident pointer so Home returns to READY and user can submit a new SOS
    try {
      localStorage.removeItem('resonix_active_incident');
      localStorage.removeItem('resonix_last_packet_id');
      localStorage.removeItem('resonix_last_client_request_id');
    } catch (_) {}

    // Brief loading delay for UX feedback
    await new Promise((r) => setTimeout(r, 350));

    setSosState('IDLE');
    setLastSubmittedPacket(null);
    setClientRequestId(null);
    setSosTimer(0);
    setToastMessage('✓ Emergency alert cancelled. Ready to submit a new emergency report.');
    setIsCancelling(false);
  };

  // Operational unit dispatch check (responder squad has been assigned or en route)
  const isFieldUnitDispatched = Boolean(
    lastSubmittedPacket?.assignedUnit ||
    (Array.isArray(lastSubmittedPacket?.assignedResponders) && lastSubmittedPacket.assignedResponders.length > 0) ||
    lastSubmittedPacket?.responseLifecycle?.dispatchTime ||
    ['EN_ROUTE', 'ON_SCENE', 'IN_PROGRESS'].includes(String(lastSubmittedPacket?.status || '').toUpperCase())
  );

  // Determine if cancellation is allowed
  // Citizens can always cancel an active emergency report; if field units are already dispatched,
  // the confirmation dialog informs them that responding units will stand down.
  const isCancellable = sosState === 'DISPATCHED';

  // Format Timer SS or MM:SS
  const formatSec = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="w-full space-y-4 text-left pb-2 animate-fade-in">
      {/* Dynamic Toast / Status Notification Bar */}
      {toastMessage && (
        <div className="p-3 rounded-xl bg-secondary/15 border border-secondary/30 text-primary text-xs font-bold flex items-center justify-between gap-2 shadow-sm animate-fade-in min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-secondary text-base animate-pulse shrink-0">info</span>
            <span className="break-words min-w-0">{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage('')}
            className="text-on-surface-variant hover:text-primary p-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Top Status & Telemetry Header Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <LocationDetectorWidget />
        <NetworkStatusWidget />
      </div>

      {/* Extreme Weather Alert Engine Banner (SIH26068) */}
      <ExtremeWeatherAlertBanner />

      {/* Live Atmospheric Conditions & Disaster Weather Alert (SIH26068) */}
      <LiveWeatherCard />

      {/* Live Rescue Dispatch Status Banner */}
      <div
        className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2 transition-all duration-300 min-w-0 ${
          sosState === 'DISPATCHED'
            ? 'bg-error/15 border-error text-error shadow-md'
            : sosState === 'CANCELLING'
            ? 'bg-secondary/10 border-secondary/30 text-secondary'
            : sosState === 'CANCELLED'
            ? 'bg-surface-container border-outline-variant text-on-surface-variant'
            : 'bg-surface-container border-outline-variant text-on-surface-variant'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div
            className={`w-3 h-3 rounded-full transition-colors ${
              sosState === 'DISPATCHED' ? 'bg-error animate-calm-dot'
              : sosState === 'CANCELLING' ? 'bg-secondary animate-pulse'
              : sosState === 'CANCELLED' ? 'bg-on-surface-variant/40'
              : 'bg-success'
            }`}
          />
          <div>
            <p className="text-[11px] font-mono uppercase tracking-wider leading-none font-extrabold">
              {sosState === 'DISPATCHED' ? '🚨 RESCUE EN ROUTE'
               : sosState === 'CANCELLING' ? 'Cancelling request...'
               : sosState === 'CANCELLED' ? 'Emergency request cancelled'
               : 'READY FOR EMERGENCY REPORT'}
            </p>
            <p className="text-[10px] text-on-surface-variant mt-0.5 font-medium">
              {sosState === 'DISPATCHED'
                ? `Category: ${lastSubmittedPacket?.category || 'CRITICAL'} • Timer: ${formatSec(sosTimer)}`
                : sosState === 'CANCELLED'
                ? 'You can submit a new request if you still need help.'
                : sosState === 'CANCELLING'
                ? 'Please wait...'
                : isCitizenGuest
                ? `Guest Session ID: ${guestId?.slice(0, 14) || 'Guest'}`
                : `User: ${citizenUser?.name || 'Citizen'}`}
            </p>
          </div>
        </div>

        {sosState === 'DISPATCHED' && (
          <span className="text-xs font-mono font-extrabold px-2 py-0.5 bg-error text-white rounded-md">
            ACTIVE
          </span>
        )}
      </div>

      {/* RESPONSE STATUS SECTION */}
      {sosState === 'DISPATCHED' && (
        <div
          className={`p-3.5 rounded-xl border flex flex-col gap-1.5 transition-all duration-300 shadow-sm ${
            isStatusChanging ? 'animate-state-change' : ''
          } ${
            acknowledgementState?.status === 'ACKNOWLEDGED'
              ? 'bg-success/15 border-success/40 text-success'
              : 'bg-surface-container border-outline-variant/60 text-on-surface-variant'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider text-on-surface-variant/80">
              RESPONSE STATUS
            </span>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
              acknowledgementState?.status === 'ACKNOWLEDGED'
                ? 'bg-success text-white'
                : 'bg-surface-container-high text-on-surface-variant'
            }`}>
              {acknowledgementState?.status === 'ACKNOWLEDGED' ? 'ACKNOWLEDGED' : 'WAITING'}
            </span>
          </div>

          <div className="flex items-start gap-2.5 pt-0.5">
            <div className="pt-0.5 shrink-0">
              {acknowledgementState?.status === 'ACKNOWLEDGED' ? (
                <span className="material-symbols-outlined text-success text-xl animate-gps-check">check_circle</span>
              ) : (
                <span className="material-symbols-outlined text-amber-500 text-xl">schedule</span>
              )}
            </div>
            <div>
              <p className={`text-xs font-black leading-tight ${
                acknowledgementState?.status === 'ACKNOWLEDGED' ? 'text-success' : 'text-primary'
              }`}>
                {acknowledgementState?.status === 'ACKNOWLEDGED'
                  ? '✓ Response Team Has Seen Your Alert'
                  : 'Waiting for responder acknowledgement'}
              </p>
              <p className="text-[10px] text-on-surface-variant mt-1 font-medium leading-relaxed">
                {acknowledgementState?.status === 'ACKNOWLEDGED'
                  ? 'Your emergency alert has been acknowledged. Help is being coordinated.'
                  : 'First responders have been notified of your emergency.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Field unit dispatch info notice (informational, does not block cancellation) */}
      {sosState === 'DISPATCHED' && isFieldUnitDispatched && (
        <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/60 flex items-center gap-2 text-[11px] text-on-surface-variant">
          <span className="material-symbols-outlined text-base text-secondary shrink-0">local_shipping</span>
          <span>Emergency response units have been dispatched and are responding.</span>
        </div>
      )}

      {/* ================================================================ */}
      {/* CANCEL EMERGENCY REQUEST — Always available while active */}
      {/* ================================================================ */}
      {isCancellable && (
        <button
          type="button"
          onClick={() => setShowCancelConfirm(true)}
          className="w-full py-3 px-4 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/60 text-on-surface-variant hover:text-error font-bold text-xs flex items-center justify-center gap-2 transition-all duration-150 cursor-pointer min-h-[48px] active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-error/40 hover:border-error/30 hover:shadow-sm"
          aria-label="Cancel emergency request"
        >
          <span className="material-symbols-outlined text-base">close</span>
          <span>Cancel emergency request</span>
        </button>
      )}

      {/* Cancelled — success message */}
      {sosState === 'CANCELLED' && (
        <div className="p-3.5 rounded-xl bg-success/8 border border-success/25 space-y-2 animate-fade-in">
          <div className="flex items-center gap-2 text-success font-bold text-xs">
            <span className="material-symbols-outlined text-base">check_circle</span>
            <span>Your emergency request has been cancelled successfully.</span>
          </div>
          <p className="text-[10px] text-on-surface-variant leading-relaxed pl-6">
            If you cancelled by mistake, tap the SOS tab to submit a new emergency report.
          </p>
        </div>
      )}

      {/* Rescue Completed — authoritative confirmation banner */}
      {completedNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2 animate-fade-in">
          <div className="flex items-center justify-between gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base">task_alt</span>
              <span>✓ Rescue Operation Marked as Complete</span>
            </div>
            <button
              type="button"
              onClick={() => setCompletedNotice(null)}
              className="text-[10px] text-on-surface-variant hover:text-primary font-bold px-2 py-0.5 rounded bg-surface border border-outline-variant/60 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
          <p className="text-[10px] text-on-surface-variant leading-relaxed pl-6">
            {completedNotice.resolutionSummary || 'Emergency response team has successfully resolved and closed this incident. You can tap the SOS tab to submit a new emergency report at any time.'}
          </p>
        </div>
      )}

      {/* ================================================================ */}
      {/* CANCEL CONFIRMATION DIALOG (Modal) */}
      {/* ================================================================ */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-fade-in">
          <Card className="bg-surface border border-outline-variant/60 max-w-sm w-full p-4 sm:p-6 space-y-4 shadow-2xl text-left animate-slide-up">
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-error/10 border border-error/25 flex items-center justify-center text-error shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-xl">warning</span>
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-primary leading-tight">Cancel emergency request?</h3>
                <p className="text-[11px] text-on-surface-variant mt-1.5 leading-relaxed">
                  {isFieldUnitDispatched
                    ? 'Emergency response teams have been notified or dispatched.'
                    : 'Are you sure you want to cancel this emergency request?'}
                </p>
              </div>
            </div>

            {/* Information text */}
            <div className="text-[11px] text-on-surface-variant leading-relaxed space-y-2 pl-0.5">
              {isFieldUnitDispatched ? (
                <>
                  <p className="text-error font-medium">
                    Confirming cancellation will stand down dispatched response units.
                  </p>
                  <p>
                    Your alert will be marked cancelled in the system and you can submit a new report anytime.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    Your request will be cancelled immediately and removed from the active queue.
                  </p>
                  <p>
                    You can submit a new emergency report at any time from the SOS tab.
                  </p>
                </>
              )}
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              {/* Keep Request — Default focus */}
              <button
                type="button"
                autoFocus
                onClick={() => setShowCancelConfirm(false)}
                className="py-3 px-4 rounded-xl bg-secondary hover:brightness-110 text-white font-bold text-xs flex items-center justify-center gap-1.5 min-h-[48px] cursor-pointer transition-all active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50"
              >
                <span className="material-symbols-outlined text-base">shield</span>
                <span>Keep request</span>
              </button>

              {/* Cancel Request */}
              <button
                type="button"
                disabled={isCancelling}
                onClick={() => handleCancelRequest()}
                className="py-3 px-4 rounded-xl bg-surface-container hover:bg-error/10 border border-outline-variant/60 hover:border-error/30 text-on-surface-variant hover:text-error font-bold text-xs flex items-center justify-center gap-1.5 min-h-[48px] cursor-pointer transition-all active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-error/40 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">{isCancelling ? 'hourglass_empty' : 'close'}</span>
                <span>{isCancelling ? 'Cancelling...' : 'Confirm & Cancel SOS'}</span>
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Citizen SOS Acknowledgement Modal */}
      <EmergencyAcknowledgementModal
        isOpen={showAcknowledgementModal}
        onClose={() => {
          setShowAcknowledgementModal(false);
          setAcknowledgementData(null);
        }}
        data={acknowledgementData}
      />
    </div>
  );
}
