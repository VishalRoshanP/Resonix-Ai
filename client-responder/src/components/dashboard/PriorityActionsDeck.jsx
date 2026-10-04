import React, { useState, useEffect, useRef } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { useLanguage } from '../../contexts/LanguageContext';

/**
 * PriorityActionsDeck ("Priority Incidents")
 * Operational deck showing only incidents that require active responder attention.
 * 
 * Default state: Compact responsive preview (1-2 rows: Mobile 2, Tablet 4, Desktop 6).
 * Expanded state: Full list with smooth transition, preserving incident order and actions.
 * 
 * Each item contains:
 * - [TYPE]
 * - Location
 * - Severity
 * - Reported time
 * - Current status
 * 
 * Actions:
 * - [View]
 * - [Acknowledge] where supported
 * - [Dispatch] where supported
 * 
 * Technical AI fields are NOT exposed on the main card.
 */
export default function PriorityActionsDeck({
  incidents = [],
  isLoading = false,
  error = null,
  onViewIncident,
  onAssignIncident,
  onAcknowledgeIncident,
  onRetry,
  onViewAllIncidents,
  formatLocation,
  getSeverity,
  getStatus,
  className = '',
}) {
  const { t } = useLanguage();
  const deckRef = useRef(null);

  // Responsive compact preview limit (1-2 rows):
  // Mobile (<768px): 2 cards (2 rows x 1 card)
  // Tablet (768px - 1023px): 4 cards (2 rows x 2 cards)
  // Desktop (>=1024px): 6 cards (2 rows x 3 cards)
  const getInitialLimit = () => {
    if (typeof window === 'undefined') return 6;
    if (window.innerWidth < 768) return 2;
    if (window.innerWidth < 1024) return 4;
    return 6;
  };

  const [isExpanded, setIsExpanded] = useState(false);
  const [previewLimit, setPreviewLimit] = useState(getInitialLimit);

  useEffect(() => {
    const handleResize = () => {
      setPreviewLimit(getInitialLimit());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const hasMore = incidents.length > previewLimit;
  const displayedIncidents = isExpanded ? incidents : incidents.slice(0, previewLimit);

  const handleToggleExpand = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      if (!next && deckRef.current) {
        // Smoothly ensure deck top remains in view when collapsing
        const rect = deckRef.current.getBoundingClientRect();
        if (rect.top < 0) {
          deckRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
      return next;
    });
  };

  const formatTimeAgo = (isoString) => {
    if (!isoString) return 'Recent';
    try {
      const d = new Date(isoString).getTime();
      if (isNaN(d)) return 'Recent';
      const diffMin = Math.round((Date.now() - d) / 60000);
      if (diffMin <= 1) return 'Just now';
      if (diffMin < 60) return `${diffMin} min ago`;
      const diffHours = Math.round(diffMin / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return `${Math.round(diffHours / 24)}d ago`;
    } catch (_) {
      return 'Recent';
    }
  };

  const getSeverityBadge = (sev) => {
    const s = String(sev || '').toUpperCase();
    if (s.includes('CRITICAL') || s.includes('LEVEL_5') || s.includes('LEVEL_4')) {
      return 'bg-error text-white font-black';
    }
    if (s.includes('HIGH') || s.includes('WARNING') || s.includes('LEVEL_3')) {
      return 'bg-amber-600 text-white font-bold';
    }
    if (s.includes('MODERATE') || s.includes('LEVEL_2')) {
      return 'bg-yellow-600 text-white font-bold';
    }
    return 'bg-surface-container-high text-primary font-bold';
  };

  return (
    <div ref={deckRef} className="space-y-2 text-left">
      {/* SOURCE SEPARATION BADGE: CITIZEN GROUND REPORTS */}
      <div className="flex items-center gap-2 px-1">
        <span className="text-[10px] font-mono font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          {t('citizen_ground_reports', 'CITIZEN GROUND REPORTS')}
        </span>
        <span className="text-[11px] text-on-surface-variant font-medium">
          Field reports received from users
        </span>
      </div>

      <Card className={`p-4 sm:p-5 border border-outline-variant/70 shadow-xs space-y-4 text-left ${className}`}>
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-outline-variant/50 pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-xl text-error" aria-hidden="true">assignment_late</span>
            <div>
              <h2 className="text-base font-black text-primary tracking-tight">
                {t('priority_incidents', 'Priority Incidents')}
              </h2>
              <p className="text-xs text-on-surface-variant">
                Sorted by existing severity and operational status
              </p>
            </div>
          </div>

          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1.5 w-full sm:w-auto">
            <span
              id="priority-incidents-count-badge"
              className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-container text-secondary font-bold border border-outline-variant whitespace-nowrap"
            >
              {incidents.length} Requiring Attention
            </span>

            <div className="flex items-center gap-1.5">
              {/* Header Expand/Collapse Toggle Button */}
              {hasMore && (
                <button
                  id="btn-toggle-priority-incidents-header"
                  type="button"
                  onClick={handleToggleExpand}
                  aria-expanded={isExpanded}
                  aria-controls="priority-incidents-grid"
                  aria-label={isExpanded ? 'Show fewer priority incidents' : 'Show all priority incidents'}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border border-secondary/40 text-secondary bg-secondary/10 hover:bg-secondary/20 focus-visible:ring-2 focus-visible:ring-secondary shrink-0 shadow-xs"
                >
                  <span className="material-symbols-outlined text-sm transition-transform duration-200" aria-hidden="true">
                    {isExpanded ? 'expand_less' : 'expand_more'}
                  </span>
                  <span>{isExpanded ? t('show_fewer', 'Show Fewer') : t('show_all', 'Show All')}</span>
                </button>
              )}

              {onViewAllIncidents && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onViewAllIncidents}
                  className="text-xs font-bold"
                >
                  All Incidents ➔
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Body States */}
        {isLoading && incidents.length === 0 ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2 text-center">
            <div className="w-5 h-5 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-mono font-bold text-secondary">
              Fetching priority emergency incidents...
            </span>
          </div>
        ) : error && incidents.length === 0 ? (
          <div className="p-6 text-center rounded-xl bg-surface border border-outline-variant/60 space-y-2">
            <span className="material-symbols-outlined text-2xl text-amber-500">cloud_off</span>
            <p className="text-xs font-bold text-primary">{error}</p>
            <p className="text-[11px] text-on-surface-variant">Waiting for live backend incident telemetry</p>
            {onRetry && (
              <Button variant="secondary" size="sm" onClick={onRetry} className="mt-2 text-xs">
                <span className="material-symbols-outlined text-xs mr-1">refresh</span>
                Retry
              </Button>
            )}
          </div>
        ) : incidents.length === 0 ? (
          <div className="p-6 text-center rounded-xl bg-surface border border-outline-variant/40 space-y-1">
            <span className="material-symbols-outlined text-2xl text-emerald-400">check_circle</span>
            <p className="text-xs font-bold text-primary">All Clear</p>
            <p className="text-xs text-on-surface-variant">
              Zero critical incidents currently requiring intervention in this sector.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div
              id="priority-incidents-grid"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 transition-all duration-300"
            >
              {displayedIncidents.map((inc, idx) => {
                const id = String(inc.id || inc._id || inc.packetId || `act_${idx}`);
                const type = (inc.category || inc.type || inc.hazardType || 'EMERGENCY').toUpperCase();
                const location = formatLocation ? formatLocation(inc) : (inc.locationStr || inc.location?.address || inc.sector || 'Salem Sector');
                const severity = getSeverity ? getSeverity(inc) : (inc.severity || inc.priority || 'HIGH').toUpperCase();
                const time = formatTimeAgo(inc.createdAt || inc.timestamp);
                const status = getStatus ? getStatus(inc) : (inc.status || inc.packetStatus || 'OPEN').toUpperCase();

                const isAcknowledged = !!(inc.acknowledgement?.acknowledgedAt || inc.acknowledgement?.status === 'ACKNOWLEDGED');
                const isResolved = status === 'RESOLVED' || status === 'COMPLETED';

                return (
                  <div
                    key={id}
                    className="p-4 rounded-xl bg-surface-container/60 border border-outline-variant hover:border-secondary transition-all flex flex-col justify-between space-y-3 shadow-xs animate-fade-in"
                  >
                    <div className="space-y-2">
                      {/* Top: [TYPE] & Severity */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sm font-black text-primary tracking-tight truncate">
                          [{type}]
                        </span>
                        <span className={`text-[9px] font-mono px-2 py-0.5 rounded uppercase shrink-0 ${getSeverityBadge(severity)}`}>
                          {severity}
                        </span>
                      </div>

                      {/* Middle: Location, Reported Time, Current Status */}
                      <div className="text-xs space-y-1 font-mono">
                        <div className="flex items-center gap-1.5 text-on-surface-variant">
                          <span className="material-symbols-outlined text-xs text-secondary shrink-0">pin_drop</span>
                          <span className="font-bold text-primary truncate">{location}</span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-on-surface-variant pt-1 border-t border-outline-variant/30">
                          <span>Reported: <strong className="text-primary">{time}</strong></span>
                          <span className={`px-2 py-0.5 rounded font-bold uppercase text-[9px] border ${
                            isResolved
                              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                              : isAcknowledged
                              ? 'bg-sky-500/15 border-sky-500/40 text-sky-400'
                              : 'bg-surface border-outline-variant text-on-surface'
                          }`}>
                            {status}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions: [View], [Acknowledge], [Dispatch] */}
                    <div className="flex items-center gap-1.5 pt-2 border-t border-outline-variant/30">
                      {/* Action 1: [View] */}
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => onViewIncident && onViewIncident(inc)}
                        className="flex-1 text-xs font-bold py-1.5 justify-center flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-xs">visibility</span>
                        <span>{t('btn_view', 'View')}</span>
                      </Button>

                      {/* Action 2: [Acknowledge] where supported */}
                      {!isAcknowledged && !isResolved && onAcknowledgeIncident && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onAcknowledgeIncident(inc)}
                          className="text-xs font-bold py-1.5 px-2.5 text-sky-400 justify-center flex items-center gap-1"
                          title="Acknowledge Incident"
                        >
                          <span className="material-symbols-outlined text-xs">check</span>
                          <span className="hidden sm:inline">Ack</span>
                        </Button>
                      )}

                      {/* Action 3: [Dispatch] where supported */}
                      {!isResolved && onAssignIncident && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onAssignIncident(inc)}
                          className="text-xs font-bold py-1.5 px-2.5 text-purple-400 justify-center flex items-center gap-1"
                          title="Dispatch Resources"
                        >
                          <span className="material-symbols-outlined text-xs">local_shipping</span>
                          <span className="hidden sm:inline">Dispatch</span>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Interactive Show All / Show Fewer Button */}
            {hasMore && (
              <div className="pt-2 flex justify-center">
                <button
                  id="btn-toggle-priority-incidents-bottom"
                  type="button"
                  onClick={handleToggleExpand}
                  aria-expanded={isExpanded}
                  aria-controls="priority-incidents-grid"
                  aria-label={isExpanded ? 'Show fewer priority incidents' : 'Show all priority incidents'}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer border border-outline-variant hover:border-secondary text-primary hover:text-secondary bg-surface-container/70 hover:bg-surface-container shadow-xs focus-visible:ring-2 focus-visible:ring-secondary group"
                >
                  <span className="material-symbols-outlined text-sm text-secondary transition-transform duration-200 group-hover:scale-110" aria-hidden="true">
                    {isExpanded ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
                  </span>
                  <span>
                    {isExpanded
                      ? t('show_fewer_priority_incidents', 'Show Fewer Priority Incidents')
                      : t('show_all_priority_incidents', `Show All Priority Incidents (${incidents.length})`)}
                  </span>
                </button>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
