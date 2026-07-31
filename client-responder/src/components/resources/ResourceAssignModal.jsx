import { useState } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';

export default function ResourceAssignModal({ resource, isOpen, onClose, onAssignComplete }) {
  const [targetIncident, setTargetIncident] = useState('INC-2026-0894');
  const [etaMinutes, setEtaMinutes] = useState(8);
  const [dispatchNotes, setDispatchNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !resource) return null;

  const ACTIVE_INCIDENTS = [
    { id: 'INC-2026-0894', label: 'INC-2026-0894 - Sector 4 Flood (Critical)' },
    { id: 'INC-2026-0892', label: 'INC-2026-0892 - Industrial Fire Block B (High)' },
    { id: 'INC-2026-0889', label: 'INC-2026-0889 - Old Town Wall Collapse (Critical)' },
    { id: 'INC-2026-0885', label: 'INC-2026-0885 - East Highway Medical (Medium)' },
  ];

  const handleSubmitAssignment = (e) => {
    e.preventDefault();
    setSubmitting(true);

    const updatedResource = {
      ...resource,
      status: 'DISPATCHED',
      statusBadge: 'bg-amber-500/15 border-amber-500 text-amber-500 font-bold',
      currentMission: `Assigned to ${targetIncident}`,
      eta: `${etaMinutes} Mins ETA`,
    };

    setTimeout(() => {
      onAssignComplete?.(updatedResource);
      setSubmitting(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-left">
      <Card className="bg-surface border border-outline-variant max-w-md w-full p-6 space-y-4 shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-outline-variant/60 pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-2xl">alt_route</span>
            <div>
              <h2 className="text-base font-extrabold text-primary leading-none">Assign Resource Unit</h2>
              <p className="text-[10px] text-on-surface-variant mt-0.5">Tactical Emergency Deployment</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-on-surface-variant hover:text-primary rounded-lg cursor-pointer">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Selected Unit Summary Box */}
        <div className="p-3 rounded-xl bg-surface-container border border-outline-variant space-y-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-primary">{resource.name}</span>
            <span className="font-mono text-secondary font-bold text-[10px]">{resource.id}</span>
          </div>
          <p className="text-[10px] text-on-surface-variant">
            Category: {resource.category} • Capacity: {resource.capacity}
          </p>
        </div>

        <form onSubmit={handleSubmitAssignment} className="space-y-4 text-xs">
          {/* Incident Selector */}
          <div className="space-y-1">
            <label className="font-bold text-primary block">Select Target Emergency Incident *</label>
            <select
              value={targetIncident}
              onChange={(e) => setTargetIncident(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-surface-container border border-outline-variant text-xs font-medium text-primary focus:outline-none focus:border-secondary cursor-pointer min-h-[44px]"
              required
            >
              {ACTIVE_INCIDENTS.map((inc) => (
                <option key={inc.id} value={inc.id}>
                  {inc.label}
                </option>
              ))}
            </select>
          </div>

          {/* ETA Minutes Input */}
          <div className="space-y-1">
            <label className="font-bold text-primary block">Estimated Arrival Time (Minutes) *</label>
            <input
              type="number"
              min={1}
              max={120}
              value={etaMinutes}
              onChange={(e) => setEtaMinutes(parseInt(e.target.value) || 5)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container border border-outline-variant text-xs font-medium text-primary focus:outline-none focus:border-secondary min-h-[44px]"
              required
            />
          </div>

          {/* Dispatch Notes */}
          <div className="space-y-1">
            <label className="font-bold text-primary block">Commander Dispatch Instructions (Optional)</label>
            <textarea
              rows={2}
              placeholder="e.g. Proceed via North Bypass to avoid flood blockage."
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
            className="py-3 font-extrabold uppercase tracking-wide text-xs min-h-[44px]"
          >
            Dispatch Unit to Incident
          </Button>
        </form>
      </Card>
    </div>
  );
}
