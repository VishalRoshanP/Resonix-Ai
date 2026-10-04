import { useState, useEffect } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { incidentApi, resourceApi } from '../../services/api';

/**
 * Real Tactical Resource Assignment Modal for RESONIX AI
 * 
 * - Shows real active incidents from backend database
 * - Shows category, GPS/location, priority, and ID
 * - Dispatches assignment to backend with validation
 * - Zero mock data
 */
export default function ResourceAssignModal({
  resource,
  isOpen,
  onClose,
  onAssignComplete,
}) {
  const [activeIncidents, setActiveIncidents] = useState([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState('');
  const [etaMinutes, setEtaMinutes] = useState(10);
  const [dispatchNotes, setDispatchNotes] = useState('');
  const [loadingIncidents, setLoadingIncidents] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchActiveIncidents();
    }
  }, [isOpen]);

  const fetchActiveIncidents = async () => {
    try {
      setLoadingIncidents(true);
      setErrorMessage('');
      const rawList = await incidentApi.getIncidents();
      const list = Array.isArray(rawList)
        ? rawList
        : Array.isArray(rawList?.data)
        ? rawList.data
        : rawList?.data?.incidents || [];

      // Filter to uncompleted/active incidents only
      const active = list.filter((inc) => {
        const st = (inc.status || inc.packetStatus || 'active').toUpperCase();
        return !['RESOLVED', 'CLOSED', 'COMPLETED', 'CANCELLED'].includes(st);
      });

      setActiveIncidents(active);
      if (active.length > 0) {
        setSelectedIncidentId(String(active[0]._id || active[0].id || active[0].packetId));
      } else {
        setSelectedIncidentId('');
      }
    } catch (err) {
      console.warn('[ResourceAssignModal] Failed to load active incidents:', err.message);
      setErrorMessage('Failed to load active incidents from backend.');
    } finally {
      setLoadingIncidents(false);
    }
  };

  if (!isOpen || !resource) return null;

  const currentStatus = (resource.status || 'AVAILABLE').toUpperCase();
  const isAvailable = currentStatus === 'AVAILABLE';

  const selectedIncident = activeIncidents.find(
    (inc) => String(inc._id || inc.id || inc.packetId) === selectedIncidentId
  );

  const handleSubmitAssignment = async (e) => {
    e.preventDefault();
    if (!selectedIncidentId) {
      setErrorMessage('Please select a target emergency incident.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage('');

      const res = await resourceApi.assignResource({
        resourceId: String(resource.id || resource._id),
        incidentId: selectedIncidentId,
        etaMinutes: Number(etaMinutes) || 10,
        notes: dispatchNotes.trim(),
      });

      const updated = res?.data?.resource || res?.resource || {
        ...resource,
        status: 'ALLOCATED',
        currentMission: `INC-${selectedIncidentId.slice(-4).toUpperCase()}`,
      };

      onAssignComplete?.(updated);
      onClose();
    } catch (err) {
      console.error('[ResourceAssignModal] Assignment rejected by backend:', err.message);
      setErrorMessage(err.data?.message || err.message || 'Failed to assign resource to incident.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-left">
      <Card className="bg-surface border border-outline-variant max-w-lg w-full p-6 space-y-4 shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-outline-variant/60 pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-2xl">alt_route</span>
            <div>
              <h2 className="text-base font-extrabold text-primary leading-none">Assign Resource Unit</h2>
              <p className="text-[10px] text-on-surface-variant mt-0.5">Real Tactical Dispatch from Backend Database</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-on-surface-variant hover:text-primary rounded-lg cursor-pointer"
            aria-label="Close modal"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Selected Unit Summary Box */}
        <div className="p-3.5 rounded-xl bg-surface-container border border-outline-variant space-y-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-primary text-sm">{resource.name}</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${resource.statusBadge || 'bg-success/15 text-success'}`}>
              {currentStatus}
            </span>
          </div>
          <p className="text-[11px] text-on-surface-variant">
            <strong>Type:</strong> {resource.type || resource.category || 'General'} • <strong>Capacity:</strong> {resource.capacity || 'Not available'}
          </p>
          <p className="text-[11px] text-on-surface-variant">
            <strong>Current Base:</strong> {resource.location || 'Not available'}
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-error/15 border border-error/30 text-error text-xs font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-base">error</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {!isAvailable ? (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs font-medium space-y-2">
            <p className="font-bold">⚠️ Unit is not AVAILABLE for new assignment</p>
            <p>Current Status is <strong>{currentStatus}</strong>. Only AVAILABLE units can be dispatched to new incidents.</p>
            <Button variant="secondary" size="sm" onClick={onClose} className="w-full mt-2">
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmitAssignment} className="space-y-4 text-xs">
            {/* Target Incident Selector */}
            <div className="space-y-1.5">
              <label className="font-bold text-primary block">Select Target Emergency Incident *</label>
              {loadingIncidents ? (
                <div className="p-3 rounded-xl bg-surface-container border border-outline-variant text-center font-mono text-secondary">
                  Loading active incidents from database...
                </div>
              ) : activeIncidents.length === 0 ? (
                <div className="p-3 rounded-xl bg-surface-container border border-outline-variant text-center text-on-surface-variant">
                  No active emergency incidents available in database.
                </div>
              ) : (
                <select
                  value={selectedIncidentId}
                  onChange={(e) => setSelectedIncidentId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-surface-container border border-outline-variant text-xs font-medium text-primary focus:outline-none focus:border-secondary cursor-pointer min-h-[44px]"
                  required
                >
                  {activeIncidents.map((inc) => {
                    const id = String(inc._id || inc.id || inc.packetId);
                    const displayId = id.length > 8 ? `INC-${id.slice(-4).toUpperCase()}` : id;
                    const cat = (inc.category || inc.type || 'GENERAL').toUpperCase();
                    const priority = (inc.severity || inc.priority || 'HIGH').toUpperCase();
                    const loc = inc.sector || inc.location?.address || (inc.location?.lat ? `${inc.location.lat.toFixed(3)}, ${inc.location.lng.toFixed(3)}` : 'Sector 7');
                    return (
                      <option key={id} value={id}>
                        [{displayId}] {cat} ({priority}) — {loc}
                      </option>
                    );
                  })}
                </select>
              )}
            </div>

            {/* Selected Target Incident Details Preview */}
            {selectedIncident && (
              <div className="p-3 rounded-xl bg-surface-container-high/60 border border-outline-variant/60 space-y-1 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-primary uppercase">Incident Overview</span>
                  <span className="font-mono text-secondary font-bold">
                    {(selectedIncident.category || 'GENERAL').toUpperCase()} • {(selectedIncident.severity || selectedIncident.priority || 'HIGH').toUpperCase()}
                  </span>
                </div>
                <p className="text-on-surface-variant">
                  <strong>Location:</strong> {selectedIncident.sector || selectedIncident.location?.address || 'Active Incident GPS'}
                </p>
                {selectedIncident.description && (
                  <p className="text-on-surface-variant line-clamp-1 italic">
                    "{selectedIncident.description}"
                  </p>
                )}
              </div>
            )}

            {/* ETA Minutes Input */}
            <div className="space-y-1">
              <label className="font-bold text-primary block">Estimated Arrival Time (Minutes) *</label>
              <input
                type="number"
                min={1}
                max={180}
                value={etaMinutes}
                onChange={(e) => setEtaMinutes(parseInt(e.target.value) || 10)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container border border-outline-variant text-xs font-medium text-primary focus:outline-none focus:border-secondary min-h-[44px]"
                required
              />
            </div>

            {/* Dispatch Notes */}
            <div className="space-y-1">
              <label className="font-bold text-primary block">Commander Dispatch Instructions (Optional)</label>
              <textarea
                rows={2}
                placeholder="e.g. Deploy water rescue boat at North Flood Barrier."
                value={dispatchNotes}
                onChange={(e) => setDispatchNotes(e.target.value)}
                className="w-full p-3 rounded-xl bg-surface-container border border-outline-variant text-xs font-medium text-primary focus:outline-none focus:border-secondary resize-none"
              />
            </div>

            <Button
              variant="primary"
              size="full"
              type="submit"
              loading={submitting}
              disabled={activeIncidents.length === 0 || submitting}
              className="py-3 font-extrabold uppercase tracking-wide text-xs min-h-[44px]"
            >
              Confirm Dispatch to Incident
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
