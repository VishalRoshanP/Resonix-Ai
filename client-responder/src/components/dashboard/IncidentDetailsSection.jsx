import { useState } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { getAuthoritativeIncidentCategory } from '../../utils/mapIncidentNormalizer';
import { isIncidentActive } from '../../utils/helpers';
import { formatDistance } from '../../utils/geoClusterMath';

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

export default function IncidentDetailsSection({
  incidents = [],
  rawIncidentsCount = 0,
  clusters = [],
  rawClustersCount = 0,
  filters,
  setFilters,
  availableCategories = [],
  isAnyFilterActive = false,
  handleResetFilters,
  isLoadingIncidents = false,
  incidentsError = null,
  isLoadingClusters = false,
  clustersError = null,
  onViewIncident,
  onFocusIncident,
  onFocusCluster,
  onInspectCluster,
  onOpenAssignModal,
  onAcknowledgeIncident,
  onResolveIncident,
  onRefreshIncidents,
  onRefreshClusters,
  formatLocation,
  getSeverity,
  getStatus,
  extractEvidence,
}) {
  const [activeTab, setActiveTab] = useState('INCIDENTS'); // 'INCIDENTS' | 'CLUSTERS'
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSectionOpen, setIsSectionOpen] = useState(true);

  return (
    <Card className="p-4 sm:p-5 border border-outline-variant/70 shadow-md space-y-4 text-left bg-surface">
      {/* Header with expand/collapse toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-secondary/15 flex items-center justify-center text-secondary shrink-0">
            <span className="material-symbols-outlined text-lg">manage_search</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-primary leading-tight">
                Recent Citizen Reports & Incident Records
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-container border border-outline-variant text-secondary font-bold">
                Citizen Reports Feed
              </span>
            </div>
            <p className="text-xs text-on-surface-variant font-mono">
              Complete multi-citizen records, triage actions, and spatial cluster aggregation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Section Collapse Toggle */}
          <button
            onClick={() => setIsSectionOpen(!isSectionOpen)}
            type="button"
            className="text-xs font-bold text-secondary flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high border border-outline-variant/60 cursor-pointer"
          >
            <span>{isSectionOpen ? 'Collapse Details' : 'Expand Details'}</span>
            <span className="material-symbols-outlined text-sm">
              {isSectionOpen ? 'expand_less' : 'expand_more'}
            </span>
          </button>
        </div>
      </div>

      {isSectionOpen && (
        <div className="space-y-4">
          {/* Subheader: Tabs & Filter Bar toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 p-1 bg-surface-container rounded-xl border border-outline-variant/50">
              <button
                onClick={() => setActiveTab('INCIDENTS')}
                type="button"
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'INCIDENTS'
                    ? 'bg-secondary text-on-secondary shadow-xs'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                <span className="material-symbols-outlined text-sm">warning</span>
                <span>Citizen Reports ({incidents.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('CLUSTERS')}
                type="button"
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'CLUSTERS'
                    ? 'bg-secondary text-on-secondary shadow-xs'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                <span className="material-symbols-outlined text-sm">hub</span>
                <span>Spatial Clusters ({clusters.length})</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                type="button"
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 cursor-pointer ${
                  isFilterOpen || isAnyFilterActive
                    ? 'bg-secondary/15 text-secondary border-secondary/40 font-bold'
                    : 'bg-surface-container text-on-surface-variant border-outline-variant/60'
                }`}
              >
                <span className="material-symbols-outlined text-sm">tune</span>
                <span>Filters {isAnyFilterActive && '• Active'}</span>
                <span className="material-symbols-outlined text-xs">
                  {isFilterOpen ? 'expand_less' : 'expand_more'}
                </span>
              </button>

              {isAnyFilterActive && (
                <button
                  onClick={handleResetFilters}
                  type="button"
                  className="text-[11px] font-bold text-amber-400 hover:underline cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Expandable Filter Drawer */}
          {isFilterOpen && (
            <div className="p-3.5 rounded-xl bg-surface-container/70 border border-outline-variant/60 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
                {/* 1. Severity */}
                <div>
                  <label className="text-[10px] uppercase font-mono font-bold text-on-surface-variant block mb-1">
                    Severity
                  </label>
                  <select
                    value={filters.severity}
                    onChange={(e) => setFilters((prev) => ({ ...prev, severity: e.target.value }))}
                    className="w-full bg-surface border border-outline-variant rounded-lg p-1.5 text-xs text-primary font-medium focus:border-secondary focus:outline-none"
                  >
                    <option value="ALL">All Severities</option>
                    <option value="CRITICAL">Critical (Level 4/5)</option>
                    <option value="HIGH">High (Level 3)</option>
                    <option value="MODERATE">Moderate (Level 2)</option>
                    <option value="LOW">Low (Level 1)</option>
                  </select>
                </div>

                {/* 2. Type */}
                <div>
                  <label className="text-[10px] uppercase font-mono font-bold text-on-surface-variant block mb-1">
                    Hazard Type
                  </label>
                  <select
                    value={filters.incidentType}
                    onChange={(e) => setFilters((prev) => ({ ...prev, incidentType: e.target.value }))}
                    className="w-full bg-surface border border-outline-variant rounded-lg p-1.5 text-xs text-primary font-medium focus:border-secondary focus:outline-none"
                  >
                    <option value="ALL">All Types</option>
                    {availableCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Time */}
                <div>
                  <label className="text-[10px] uppercase font-mono font-bold text-on-surface-variant block mb-1">
                    Time Window
                  </label>
                  <select
                    value={filters.time}
                    onChange={(e) => setFilters((prev) => ({ ...prev, time: e.target.value }))}
                    className="w-full bg-surface border border-outline-variant rounded-lg p-1.5 text-xs text-primary font-medium focus:border-secondary focus:outline-none"
                  >
                    <option value="ALL">All Recorded Time</option>
                    <option value="1H">Past 1 Hour</option>
                    <option value="4H">Past 4 Hours</option>
                    <option value="24H">Past 24 Hours</option>
                    <option value="TODAY">Today Only</option>
                  </select>
                </div>

                {/* 4. Sector / Address */}
                <div>
                  <label className="text-[10px] uppercase font-mono font-bold text-on-surface-variant block mb-1">
                    Location / Sector
                  </label>
                  <input
                    type="text"
                    placeholder="Search address..."
                    value={filters.location}
                    onChange={(e) => setFilters((prev) => ({ ...prev, location: e.target.value }))}
                    className="w-full bg-surface border border-outline-variant rounded-lg p-1.5 text-xs text-primary font-medium focus:border-secondary focus:outline-none placeholder:text-on-surface-variant/50"
                  />
                </div>

                {/* 5. Status */}
                <div>
                  <label className="text-[10px] uppercase font-mono font-bold text-on-surface-variant block mb-1">
                    Status
                  </label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
                    className="w-full bg-surface border border-outline-variant rounded-lg p-1.5 text-xs text-primary font-medium focus:border-secondary focus:outline-none"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="ACTIVE">Active Operations</option>
                    <option value="RESOLVED">Resolved Only</option>
                  </select>
                </div>

                {/* 6. Weather Association */}
                <div>
                  <label className="text-[10px] uppercase font-mono font-bold text-on-surface-variant block mb-1">
                    Weather Link
                  </label>
                  <select
                    value={filters.weatherAssociation}
                    onChange={(e) => setFilters((prev) => ({ ...prev, weatherAssociation: e.target.value }))}
                    className="w-full bg-surface border border-outline-variant rounded-lg p-1.5 text-xs text-primary font-medium focus:border-secondary focus:outline-none"
                  >
                    <option value="ALL">All Incidents</option>
                    <option value="WARNED_ONLY">Warned Hazards Only</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: CITIZEN INCIDENTS OPERATIONAL FEED */}
          {activeTab === 'INCIDENTS' && (
            <div className="space-y-3">
              {isLoadingIncidents && incidents.length === 0 ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2.5 text-center">
                  <div className="w-5 h-5 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-mono font-bold text-secondary">
                    Fetching real backend citizen incidents...
                  </span>
                </div>
              ) : incidentsError && incidents.length === 0 ? (
                <div className="p-6 text-center rounded-xl bg-surface-container border border-outline-variant/60 space-y-2">
                  <span className="material-symbols-outlined text-2xl text-amber-500">cloud_off</span>
                  <p className="text-xs font-bold text-primary">{incidentsError}</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={onRefreshIncidents}
                    className="mt-2 text-xs font-bold inline-flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-xs">refresh</span>
                    <span>Retry Fetching Incidents</span>
                  </Button>
                </div>
              ) : incidents.length === 0 ? (
                <div className="p-6 text-center rounded-xl bg-surface-container border border-outline-variant/40 space-y-1">
                  <span className="material-symbols-outlined text-2xl text-on-surface-variant/70">inbox</span>
                  <p className="text-xs text-on-surface-variant font-medium">
                    No emergency incidents recorded in database matching criteria.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {incidents.map((inc, incIdx) => {
                    const id = String(inc._id || inc.id || inc.packetId || `inc_${incIdx}`);
                    const displayId = inc.displayId || (id.length > 8 ? `INC-${id.slice(-6).toUpperCase()}` : `INC-${id}`);
                    const category = getAuthoritativeIncidentCategory(inc).toUpperCase();
                    const priority = getSeverity(inc);
                    const status = getStatus(inc);
                    const locationStr = formatLocation(inc);
                    const clockTime = formatClockTime(inc.createdAt || inc.timestamp);
                    const relTime = formatRelativeTime(inc.createdAt || inc.timestamp);
                    const evidence = extractEvidence(inc);
                    const isAcknowledged = !!inc.acknowledgement?.acknowledgedAt;
                    const isResolved = status === 'RESOLVED' || status === 'COMPLETED';

                    let priorityBadge = 'bg-blue-600 text-white';
                    if (['CRITICAL', 'LEVEL_4', 'LEVEL_5'].includes(priority)) priorityBadge = 'bg-error text-white font-bold';
                    else if (['HIGH', 'WARNING', 'LEVEL_3'].includes(priority)) priorityBadge = 'bg-amber-600 text-white font-bold';

                    return (
                      <div
                        key={id}
                        className="p-3.5 rounded-xl bg-surface-container border border-outline-variant/60 hover:bg-surface-container-high/60 transition-colors space-y-2"
                      >
                        {/* Header Row */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-primary text-xs">{category}</span>
                            <span className={`text-[9px] font-mono px-2 py-0.5 rounded ${priorityBadge}`}>
                              {priority}
                            </span>
                            <span
                              className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                                isResolved
                                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                                  : isAcknowledged
                                  ? 'bg-sky-500/15 border-sky-500/40 text-sky-400'
                                  : 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                              }`}
                            >
                              {status}
                            </span>
                            {isAcknowledged && (
                              <span className="text-[9px] font-mono text-sky-400 flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-xs">done_all</span>
                                <span>ACK</span>
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] font-mono text-on-surface-variant flex items-center gap-2">
                            <span className="font-bold text-primary">{clockTime}</span>
                            {relTime && <span>({relTime})</span>}
                            <span className="text-secondary font-bold">• {displayId}</span>
                          </div>
                        </div>

                        {/* Location & Summary */}
                        <div className="text-xs space-y-0.5">
                          <p className="text-on-surface-variant font-medium flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm text-secondary">pin_drop</span>
                            <span>Location: <strong className="text-primary">{locationStr}</strong></span>
                          </p>

                          {(inc.description || inc.citizenInput?.textDescription || inc.aiAnalysis?.summary) && (
                            <p className="text-xs text-primary/90 pl-5 line-clamp-1 italic">
                              "{inc.description || inc.citizenInput?.textDescription || inc.aiAnalysis?.summary}"
                            </p>
                          )}
                        </div>

                        {/* Evidence & Action Buttons */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-outline-variant/30">
                          <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
                            {evidence.hasPhoto && (
                              <span className="px-2 py-0.5 rounded bg-surface border border-outline-variant/60 text-primary flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs">image</span>
                                <span>Photo</span>
                              </span>
                            )}
                            {evidence.hasVoice && (
                              <span className="px-2 py-0.5 rounded bg-surface border border-outline-variant/60 text-sky-400 flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs">mic</span>
                                <span>Voice</span>
                              </span>
                            )}
                            {evidence.hasGps && (
                              <span className="px-2 py-0.5 rounded bg-surface border border-outline-variant/60 text-emerald-400 flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs">gps_fixed</span>
                                <span>GPS</span>
                              </span>
                            )}
                            {inc.assignedUnit && (
                              <span className="px-2 py-0.5 rounded bg-purple-500/15 border border-purple-500/40 text-purple-300 font-bold flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs">shield</span>
                                <span>{inc.assignedUnit}</span>
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => onViewIncident(inc)}
                              className="text-[10px] py-1 px-2.5 font-bold flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-xs">visibility</span>
                              <span>View Incident</span>
                            </Button>

                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => onOpenAssignModal(inc)}
                              disabled={isResolved}
                              className="text-[10px] py-1 px-2.5 font-bold text-purple-400 flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-xs">person_add</span>
                              <span>Assign</span>
                            </Button>

                            {!isAcknowledged && !isResolved && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => onAcknowledgeIncident(inc)}
                                className="text-[10px] py-1 px-2.5 font-bold text-sky-400 flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-xs">check</span>
                                <span>Acknowledge</span>
                              </Button>
                            )}

                            {!isResolved && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => onResolveIncident(inc)}
                                className="text-[10px] py-1 px-2.5 font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-xs">task_alt</span>
                                <span>Resolve</span>
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SPATIAL INCIDENT CLUSTERS */}
          {activeTab === 'CLUSTERS' && (
            <div className="space-y-3">
              {isLoadingClusters && clusters.length === 0 ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2.5 text-center">
                  <div className="w-5 h-5 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-mono font-bold text-secondary">
                    Evaluating live incident clusters from database...
                  </span>
                </div>
              ) : clustersError && clusters.length === 0 ? (
                <div className="p-6 text-center rounded-xl bg-surface-container border border-outline-variant/60 space-y-2">
                  <span className="material-symbols-outlined text-2xl text-amber-500">cloud_off</span>
                  <p className="text-xs font-bold text-primary">{clustersError}</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={onRefreshClusters}
                    className="mt-2 text-xs font-bold inline-flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-xs">refresh</span>
                    <span>Retry Cluster Evaluation</span>
                  </Button>
                </div>
              ) : clusters.length === 0 ? (
                <div className="p-6 text-center rounded-xl bg-surface-container border border-outline-variant/40 space-y-1">
                  <span className="material-symbols-outlined text-2xl text-on-surface-variant/70">check_circle</span>
                  <p className="text-xs text-on-surface-variant font-medium">
                    No incident clusters matching selected criteria.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {clusters.map((cluster, cIdx) => {
                    const priority = (cluster.highestPriority || cluster.priority || 'HIGH').toUpperCase();
                    let priorityBadgeClass = 'bg-blue-600 text-white';
                    if (priority === 'CRITICAL') priorityBadgeClass = 'bg-red-700 text-white font-bold';
                    else if (priority === 'HIGH' || priority === 'WARNING') priorityBadgeClass = 'bg-amber-600 text-white font-bold';

                    const dominantHazard = (cluster.dominantHazard || 'GENERAL').toUpperCase();
                    const groupTitle = `${dominantHazard} CLUSTER`;
                    const repCount = cluster.reportCount || cluster.numberOfReports || 1;
                    const locCount = cluster.locationsCount || cluster.geographicArea?.locationsCount || 1;
                    const firstTimeStr = formatClockTime(cluster.firstReportTime || cluster.timeWindow?.first);
                    const latestTimeStr = formatClockTime(cluster.latestReportTime || cluster.timeWindow?.last);

                    return (
                      <div
                        key={cluster.clusterId || cluster.id || cluster._id || `cluster_${cIdx}`}
                        className="p-3.5 rounded-xl bg-surface-container border border-outline-variant hover:border-secondary transition-all space-y-2.5 shadow-xs text-left"
                      >
                        <div className="border-b border-outline-variant/50 pb-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-sm font-black tracking-tight text-primary">
                              {groupTitle}
                            </span>
                            <span className={`text-[9px] font-mono px-2 py-0.5 rounded uppercase ${priorityBadgeClass}`}>
                              {priority}
                            </span>
                          </div>

                          <div className="mt-2 space-y-0.5 font-mono text-xs">
                            <div className="font-extrabold text-secondary">
                              {repCount} {repCount === 1 ? 'report' : 'reports'} • {locCount} {locCount === 1 ? 'location' : 'locations'}
                            </div>
                            <div className="text-on-surface-variant">
                              First: <strong className="text-primary">{firstTimeStr}</strong> • Latest: <strong className="text-primary">{latestTimeStr}</strong>
                            </div>
                          </div>
                        </div>

                        {cluster.geographicArea?.spreadMeters != null && (
                          <div className="text-[10px] font-mono text-on-surface-variant">
                            Geographic Spread: {formatDistance(cluster.geographicArea.spreadMeters)}
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-1 border-t border-outline-variant/30">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => onFocusCluster(cluster)}
                            className="flex-1 text-[11px] font-bold py-1 justify-center flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-xs">filter_center_focus</span>
                            <span>Map Focus</span>
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => onInspectCluster(cluster)}
                            className="flex-1 text-[11px] font-bold py-1 justify-center flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-xs">visibility</span>
                            <span>Inspect</span>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
