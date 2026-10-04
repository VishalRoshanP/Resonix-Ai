import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { citizenApi } from '../../services/api';
import { removeLocalPacket, getLocalPackets } from '../../services/emergencyPacketManager';
import { offlineCommunicationService } from '../../services/offlineCommunicationService';
import LocationDetectorWidget from '../../components/location/LocationDetectorWidget';
import NetworkStatusWidget from '../../components/network/NetworkStatusWidget';
import EmergencyReportModal from '../../components/emergency/EmergencyReportModal';
import EmergencyAcknowledgementModal, { isIncidentAcknowledged, markIncidentAcknowledged } from '../../components/emergency/EmergencyAcknowledgementModal';
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

export default function CitizenSOSPage() {
  const { citizenUser, isCitizenGuest } = useAuth();
  const { settings } = useSettings();

  const initialActiveIncident = getStoredActiveIncident();

  // Emergency States: 'IDLE' | 'DISPATCHED' | 'CANCELLING'
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

  // Acknowledgement modal state
  const [acknowledgementData, setAcknowledgementData] = useState(null);
  const [showAcknowledgementModal, setShowAcknowledgementModal] = useState(false);

  // Refs
  const sosDispatchIntervalRef = useRef(null);
  const toastTimerRef = useRef(null);
  const isMountedRef = useRef(true);

  const showToast = (msg, durationMs = 5000) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    if (msg) {
      toastTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setToastMessage('');
        }
      }, durationMs);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (sosDispatchIntervalRef.current) clearInterval(sosDispatchIntervalRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Live timer for active emergency
  useEffect(() => {
    if (sosState === 'DISPATCHED') {
      sosDispatchIntervalRef.current = setInterval(() => {
        setSosTimer((prev) => prev + 1);
      }, 1000);
    } else {
      if (sosDispatchIntervalRef.current) clearInterval(sosDispatchIntervalRef.current);
    }
    return () => {
      if (sosDispatchIntervalRef.current) clearInterval(sosDispatchIntervalRef.current);
    };
  }, [sosState]);

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

  // Callback when EmergencyReportModal submits packet
  const handlePacketSubmitted = (packet, responseResult = {}) => {
    setCompletedNotice(null);
    setLastSubmittedPacket(packet);
    setSosState('DISPATCHED');

    // Play emergency sound if enabled in settings
    if (settings?.emergencySound) {
      playEmergencyTone();
    }

    const isOnlineSuccess = Boolean(responseResult?.isOnlineSuccess);
    const alertId =
      responseResult?.data?.packetId ||
      responseResult?.packetId ||
      responseResult?.data?.data?._id ||
      packet?.clientRequestId ||
      packet?.packetId ||
      clientRequestId;

    const locationText =
      packet?.gpsCoordinates?.latitude != null
        ? `GPS: ${packet.gpsCoordinates.latitude.toFixed(4)}, ${packet.gpsCoordinates.longitude.toFixed(4)}`
        : packet?.incidentMetadata?.sector || packet?.sector || 'Live Telemetry Sector';

    const activeIncidentPayload = {
      packetId: packet?.packetId || alertId,
      clientRequestId: packet?.clientRequestId || clientRequestId,
      incidentId: responseResult?.data?.data?._id || responseResult?.incident?._id || alertId,
      category: packet?.category || packet?.selectedCategory || 'EMERGENCY',
      location: locationText,
      gpsCoordinates: packet?.gpsCoordinates,
      timestamp: packet?.timestamp || new Date().toISOString(),
      offline: !isOnlineSuccess,
      status: isOnlineSuccess ? 'ACTIVE' : 'QUEUED_LOCAL',
    };
    try {
      localStorage.setItem('resonix_active_incident', JSON.stringify(activeIncidentPayload));
      if (packet?.packetId) localStorage.setItem('resonix_last_packet_id', packet.packetId);
      if (packet?.clientRequestId) localStorage.setItem('resonix_last_client_request_id', packet.clientRequestId);
    } catch (_) {}

    if (isOnlineSuccess) {
      showToast('🚨 Emergency Alert Received! Help is being coordinated.', 5000);
      if (!isIncidentAcknowledged(alertId)) {
        markIncidentAcknowledged(alertId);
        setAcknowledgementData({
          alertId,
          status: 'ACTIVE',
          location: locationText,
          category: packet?.category || 'EMERGENCY',
        });
        setShowAcknowledgementModal(true);
      }

      // Automatic emergency call prompt/trigger if enabled in settings
      if (settings?.autoDial112) {
        setTimeout(() => {
          try {
            window.location.href = 'tel:112';
          } catch (_) {}
        }, 1200);
      }
    } else {
      showToast('⚡ Emergency saved: Saved on this device and will be sent when a network connection is available.', 5000);
    }
  };

  // Cancel SOS request
  const handleCancelRequest = async () => {
    if (isCancelling) return;
    setIsCancelling(true);
    setShowCancelConfirm(false);
    setSosState('CANCELLING');

    const targetPacketId = lastSubmittedPacket?.incidentId || lastSubmittedPacket?._id || lastSubmittedPacket?.packetId || clientRequestId;

    try {
      if (targetPacketId) {
        await citizenApi.cancelSOS(targetPacketId);
      }
    } catch (err) {
      console.warn('[CitizenSOSPage] Cancel API call failed (non-blocking):', err.message);
    }

    if (targetPacketId) {
      removeLocalPacket(targetPacketId);
      if (offlineCommunicationService) {
        offlineCommunicationService.updateMessageStatus(targetPacketId, 'CANCELLED');
        offlineCommunicationService.removeMessage(targetPacketId);
      }
    }

    try {
      localStorage.removeItem('resonix_active_incident');
      localStorage.removeItem('resonix_last_packet_id');
      localStorage.removeItem('resonix_last_client_request_id');
    } catch (_) {}

    await new Promise((r) => setTimeout(r, 350));

    setSosState('IDLE');
    setLastSubmittedPacket(null);
    setClientRequestId(null);
    setSosTimer(0);
    showToast('✓ Emergency alert cancelled. Ready to submit a new emergency report.', 4000);
    setIsCancelling(false);
  };

  const isFieldUnitDispatched = Boolean(
    lastSubmittedPacket?.assignedUnit ||
    (Array.isArray(lastSubmittedPacket?.assignedResponders) && lastSubmittedPacket.assignedResponders.length > 0) ||
    lastSubmittedPacket?.responseLifecycle?.dispatchTime ||
    ['EN_ROUTE', 'ON_SCENE', 'IN_PROGRESS'].includes(String(lastSubmittedPacket?.status || '').toUpperCase())
  );

  const isCancellable = sosState === 'DISPATCHED';

  const formatSec = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="w-full space-y-4 text-left pb-6 animate-fade-in">
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

      {/* 1. LOCATION STATUS CARD & 2. NETWORK STATUS CARD */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <LocationDetectorWidget />
        <NetworkStatusWidget />
      </div>

      {/* Active Rescue Dispatch Status Banner (If Dispatched) */}
      {sosState === 'DISPATCHED' && (
        <div className="space-y-3 animate-fade-in">
          <div className="p-3.5 rounded-xl border bg-error/15 border-error text-error shadow-md flex flex-wrap items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2.5">
              <div className="w-3 h-3 rounded-full bg-error animate-calm-dot" />
              <div>
                <p className="text-[11px] font-mono uppercase tracking-wider leading-none font-extrabold text-error">
                  🚨 RESCUE EN ROUTE
                </p>
                <p className="text-[10px] text-on-surface-variant mt-0.5 font-medium">
                  Category: {lastSubmittedPacket?.category || 'CRITICAL'} • Timer: {formatSec(sosTimer)}
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-extrabold px-2 py-0.5 bg-error text-white rounded-md">
              ACTIVE
            </span>
          </div>

          {/* RESPONSE STATUS SECTION */}
          <div className="p-3.5 rounded-xl border bg-surface-container border-outline-variant/60 flex flex-col gap-1.5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider text-on-surface-variant/80">
                RESPONSE STATUS
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-surface-container-high text-on-surface-variant">
                WAITING FOR RESPONDER
              </span>
            </div>
            <div className="flex items-start gap-2.5 pt-0.5">
              <span className="material-symbols-outlined text-amber-500 text-xl shrink-0">schedule</span>
              <div>
                <p className="text-xs font-black text-primary leading-tight">
                  Emergency alert transmitted to Command Center
                </p>
                <p className="text-[10px] text-on-surface-variant mt-1 font-medium leading-relaxed">
                  First responders have been notified with your real-time telemetry. Help is on the way.
                </p>
              </div>
            </div>
          </div>

          {/* Field unit dispatch notice */}
          {isFieldUnitDispatched && (
            <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/60 flex items-center gap-2 text-[11px] text-on-surface-variant">
              <span className="material-symbols-outlined text-base text-secondary shrink-0">local_shipping</span>
              <span>Emergency response units have been dispatched and are responding.</span>
            </div>
          )}

          {/* CANCEL EMERGENCY REQUEST BUTTON */}
          {isCancellable && (
            <button
              type="button"
              onClick={() => setShowCancelConfirm(true)}
              className="w-full py-3 px-4 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/60 text-on-surface-variant hover:text-error font-bold text-xs flex items-center justify-center gap-2 transition-all duration-150 cursor-pointer min-h-[48px] active:scale-[0.99] focus:outline-none hover:border-error/30 hover:shadow-sm"
              aria-label="Cancel emergency request"
            >
              <span className="material-symbols-outlined text-base">close</span>
              <span>Cancel emergency request</span>
            </button>
          )}
        </div>
      )}

      {/* 3 - 10. MAIN SOS INTERFACE (REUSED EMERGENCY REPORT COMPONENT IN FULL-PAGE MODE) */}
      <EmergencyReportModal
        isModal={false}
        isOpen={true}
        onSubmitted={handlePacketSubmitted}
        clientRequestId={clientRequestId}
      />

      {/* CANCEL CONFIRMATION DIALOG */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <Card className="bg-surface border border-outline-variant/60 max-w-sm w-full p-5 sm:p-6 space-y-4 shadow-2xl text-left animate-slide-up">
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

            <div className="text-[11px] text-on-surface-variant leading-relaxed space-y-2 pl-0.5">
              <p>
                Your request will be cancelled immediately and removed from the active queue. You can submit a new emergency report at any time.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                autoFocus
                onClick={() => setShowCancelConfirm(false)}
                className="py-3 px-4 rounded-xl bg-secondary hover:brightness-110 text-white font-bold text-xs flex items-center justify-center gap-1.5 min-h-[48px] cursor-pointer transition-all active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-base">shield</span>
                <span>Keep request</span>
              </button>

              <button
                type="button"
                disabled={isCancelling}
                onClick={handleCancelRequest}
                className="py-3 px-4 rounded-xl bg-surface-container hover:bg-error/10 border border-outline-variant/60 hover:border-error/30 text-on-surface-variant hover:text-error font-bold text-xs flex items-center justify-center gap-1.5 min-h-[48px] cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">{isCancelling ? 'hourglass_empty' : 'close'}</span>
                <span>{isCancelling ? 'Cancelling...' : 'Confirm & Cancel'}</span>
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
