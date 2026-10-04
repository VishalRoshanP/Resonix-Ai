import { useEffect } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';

const ACKNOWLEDGED_STORAGE_KEY = 'resonix_acknowledged_incidents';

/**
 * Retrieves list of acknowledged incident IDs from persistent local storage
 * @returns {Array<string>}
 */
export function getAcknowledgedIncidents() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = localStorage.getItem(ACKNOWLEDGED_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

/**
 * Marks a specific incident ID as acknowledged to prevent duplicate notifications
 * @param {string} incidentId
 */
export function markIncidentAcknowledged(incidentId) {
  if (!incidentId) return;
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const current = getAcknowledgedIncidents();
    if (!current.includes(incidentId)) {
      const updated = [...current, incidentId];
      localStorage.setItem(ACKNOWLEDGED_STORAGE_KEY, JSON.stringify(updated));
    }
  } catch (_) {}
}

/**
 * Checks if an incident ID has already been acknowledged
 * @param {string} incidentId
 * @returns {boolean}
 */
export function isIncidentAcknowledged(incidentId) {
  if (!incidentId) return false;
  const current = getAcknowledgedIncidents();
  return current.includes(incidentId);
}

/**
 * Citizen SOS Acknowledgement Modal
 * Displays reassuring confirmation after server accepts emergency alert.
 */
export default function EmergencyAcknowledgementModal({ isOpen, onClose, data }) {
  // Lock body scroll when active
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !data) return null;

  const alertId = data.alertId || data.packetId || data.clientRequestId || 'RESONIX-SOS';
  const status = data.status || 'ACTIVE';
  const location = data.location || 'Location acquired';

  const handleGotIt = (e) => {
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    // ONLY dismiss/close the acknowledgement dialog.
    // Does NOT submit another SOS, create incident, resend request, or trigger API calls.
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 animate-fade-in bg-black/60 backdrop-blur-xs overflow-y-auto">
      <Card className="bg-surface border border-outline-variant/60 max-w-md w-full p-5 sm:p-6 space-y-5 shadow-2xl text-left my-auto rounded-2xl relative">
        {/* SUCCESS ICON BADGE */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-success/15 border border-success/30 flex items-center justify-center text-success shrink-0">
            <span className="material-symbols-outlined text-3xl">check_circle</span>
          </div>
          <div>
            <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider text-success px-2 py-0.5 rounded-md bg-success/10 border border-success/20">
              CONFIRMED BY COMMAND CENTER
            </span>
            <h2 className="text-lg sm:text-xl font-extrabold text-primary leading-tight mt-1">
              Emergency Alert Received
            </h2>
          </div>
        </div>

        {/* REASSURING MESSAGE */}
        <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
          Your emergency request has been received by the Emergency Command Center. Help is being coordinated.
        </p>

        {/* REAL SOS DETAILS */}
        <div className="bg-surface-container-low/80 border border-outline-variant/60 rounded-xl p-3.5 space-y-2.5">
          {/* Alert ID */}
          <div className="flex items-center justify-between text-xs gap-2">
            <span className="font-bold text-on-surface-variant flex items-center gap-1.5 shrink-0">
              <span className="material-symbols-outlined text-success text-sm">check</span>
              Alert ID:
            </span>
            <span className="font-mono font-bold text-primary truncate max-w-[200px]" title={alertId}>
              {alertId}
            </span>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between text-xs gap-2">
            <span className="font-bold text-on-surface-variant flex items-center gap-1.5 shrink-0">
              <span className="material-symbols-outlined text-success text-sm">check</span>
              Status:
            </span>
            <span className="font-mono font-extrabold text-xs px-2 py-0.5 bg-success/15 text-success border border-success/30 rounded-md uppercase tracking-wider">
              {status}
            </span>
          </div>

          {/* Location */}
          <div className="flex items-start justify-between text-xs gap-2 pt-1 border-t border-outline-variant/40">
            <span className="font-bold text-on-surface-variant flex items-center gap-1.5 shrink-0">
              <span className="material-symbols-outlined text-success text-sm">check</span>
              Location:
            </span>
            <span className="font-medium text-primary text-right break-words max-w-[220px]">
              {location}
            </span>
          </div>
        </div>

        {/* DISMISS BUTTON ONLY */}
        <div className="pt-2">
          <Button
            type="button"
            variant="primary"
            size="full"
            onClick={handleGotIt}
            className="py-3 font-bold text-sm shadow-md"
          >
            Got it
          </Button>
        </div>
      </Card>
    </div>
  );
}
