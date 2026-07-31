import { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import IncidentDetailModal from '../components/incidents/IncidentDetailModal';
import { incidentApi } from '../services/api';
import useSocket from '../hooks/useSocket';

export default function IncidentsPage() {
  const location = useLocation();
  const hasAutoOpenedRef = useRef(false);

  const [incidents, setIncidents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');

  const [selectedIncident, setSelectedIncident] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [highlightedId, setHighlightedId] = useState(null);
  const [dashboardBanner, setDashboardBanner] = useState('');
  const [activeIncidentId, setActiveIncidentId] = useState(null);
  const [isOpenedFromDashboard, setIsOpenedFromDashboard] = useState(false);

  // Clear History State
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isClearingHistory, setIsClearingHistory] = useState(false);
  const [clearNotification, setClearNotification] = useState(null);

  // Delete Single Active Incident State
  const [incidentToDelete, setIncidentToDelete] = useState(null);
  const [isDeletingActiveIncident, setIsDeletingActiveIncident] = useState(false);

  // Fetch REAL incidents from backend API with automatic live refresh polling (5s)
  useEffect(() => {
    fetchRealIncidents();
    const pollInterval = setInterval(() => {
      fetchRealIncidents(true);
    }, 5000);
    return () => clearInterval(pollInterval);
  }, []);

  const fetchRealIncidents = async (isBackgroundPoll = false) => {
    if (!isBackgroundPoll) setIsLoading(true);
    try {
      const res = await incidentApi.getIncidents();
      const rawList = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : res?.data?.incidents || res?.data?.data || [];
      console.log(`[IncidentsPage] 📥 Received ${rawList.length} incident(s) from GET /api/v1/incidents API.`);
        
      // Transform real backend documents to UI representation
      const realIncidents = rawList.map((doc) => {
        const mongoId = doc._id ? String(doc._id) : (doc.id ? String(doc.id) : (doc.packetId ? String(doc.packetId) : ''));
        const actualId = mongoId || (doc.packetId ? String(doc.packetId) : 'Not Found');
        const displayId = mongoId && mongoId.length >= 4 ? `INC-${mongoId.slice(-4).toUpperCase()}` : actualId;
        const category = (doc.category || doc.type || doc.aiAnalysis?.disasterCategory || 'GENERAL').toUpperCase();
        const priority = (doc.severity || doc.priority || doc.aiAnalysis?.severity || 'MEDIUM').toUpperCase();

        let priorityBadge = 'bg-secondary text-white';
        if (priority === 'CRITICAL') priorityBadge = 'bg-error text-white';
        else if (priority === 'HIGH' || priority === 'WARNING') priorityBadge = 'bg-amber-500 text-white';
        else if (priority === 'LOW') priorityBadge = 'bg-surface-container-high text-primary';

        const status = (doc.status || doc.packetStatus || 'OPEN').toUpperCase();
        let statusBadge = 'bg-surface-container border-outline-variant text-on-surface-variant';
        if (status === 'DISPATCHED') statusBadge = 'bg-warning/15 border-warning text-warning';
        else if (status === 'EN_ROUTE') statusBadge = 'bg-secondary/15 border-secondary text-secondary';
        else if (status === 'ON_SCENE') statusBadge = 'bg-error/15 border-error text-error font-bold';
        else if (status === 'RESOLVED') statusBadge = 'bg-success/15 border-success text-success';

        // Extract real location from backend document
        const realLocation = doc.sector || doc.location?.address || (doc.location?.lat && doc.location?.lng ? `GPS: ${doc.location.lat.toFixed(4)}, ${doc.location.lng.toFixed(4)}` : 'Live Telemetry Location');

        // Extract real citizen name / user ID
        const citizenName = doc.victimName || doc.citizenName || doc.user?.name || doc.userId || 'Citizen User';

        // Extract real assigned unit from backend
        const assignedUnit = doc.assignedResponders?.[0]?.name || doc.assignedUnit || 'Unassigned / Pending Dispatch';

        const createdAtRaw = doc.createdAt ? new Date(doc.createdAt).getTime() : (doc.timestamp ? new Date(doc.timestamp).getTime() : Date.now());

        return {
          id: actualId,
          _id: actualId,
          mongoId: actualId,
          displayId,
          packetId: doc.packetId ? String(doc.packetId) : actualId,
          citizenId: doc.citizenId || doc.userId || doc.packetId || 'usr_citizen_telemetry',
          citizenName,
          category,
          aiSummary: doc.description || doc.title || doc.aiSummary || doc.aiAnalysis?.summary || 'Citizen Emergency SOS',
          priority,
          priorityBadge,
          location: realLocation,
          status,
          statusBadge,
          assignedUnit,
          time: doc.createdAt ? new Date(doc.createdAt).toLocaleString() : new Date().toLocaleString(),
          createdAtRaw,
          completedAt: doc.completedAt ? new Date(doc.completedAt).toLocaleString() : (status === 'RESOLVED' || status === 'CLOSED' ? new Date(doc.updatedAt || Date.now()).toLocaleString() : 'N/A'),
          completedBy: doc.completedBy || 'Command Officer',
          resolutionSummary: doc.resolutionSummary || doc.completionNotes || 'Emergency resolved by response unit',
          resolutionDuration: doc.createdAt && doc.completedAt ? `${Math.max(1, Math.round((new Date(doc.completedAt) - new Date(doc.createdAt)) / (1000 * 60)))} min` : 'N/A',
          rawDoc: doc,
        };
      });

      // Sort newest created incident FIRST
      realIncidents.sort((a, b) => b.createdAtRaw - a.createdAtRaw);

      setIncidents(realIncidents);
    } catch (err) {
      console.warn('[IncidentsPage] Failed to fetch real incidents:', err.message);
      setIncidents([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Multi-Field Filtering Logic on REAL backend incidents
  const filteredIncidents = useMemo(() => {
    if (!Array.isArray(incidents)) return [];
    return incidents.filter((inc) => {
      if (!inc) return false;
      const query = (searchQuery || '').toLowerCase();
      const incId = (inc.id || '').toLowerCase();
      const citId = (inc.citizenId || '').toLowerCase();
      const loc = (inc.location || '').toLowerCase();
      const cat = (inc.category || '').toLowerCase();

      const matchesSearch =
        !searchQuery ||
        incId.includes(query) ||
        citId.includes(query) ||
        loc.includes(query) ||
        cat.includes(query);

      const isIncActive = !['RESOLVED', 'CLOSED', 'COMPLETED'].includes(inc.status);
      const matchesPriority = filterPriority === 'ALL' || inc.priority === filterPriority;
      const matchesStatus =
        filterStatus === 'ALL' ||
        (filterStatus === 'ACTIVE' && isIncActive) ||
        (filterStatus === 'RESOLVED' && !isIncActive) ||
        inc.status === filterStatus;
      const matchesCategory = filterCategory === 'ALL' || inc.category === filterCategory || (inc.category && inc.category.includes(filterCategory));

      return matchesSearch && matchesPriority && matchesStatus && matchesCategory;
    });
  }, [incidents, searchQuery, filterPriority, filterStatus, filterCategory]);

  // Separate Active vs Completed Incidents (Safely operates on filteredIncidents)
  const activeIncidents = useMemo(() => {
    if (!Array.isArray(filteredIncidents)) return [];
    return filteredIncidents.filter((inc) => inc && inc.status !== 'RESOLVED' && inc.status !== 'CLOSED' && inc.status !== 'COMPLETED');
  }, [filteredIncidents]);

  const completedIncidents = useMemo(() => {
    if (!Array.isArray(filteredIncidents)) return [];
    return filteredIncidents.filter((inc) => inc && (inc.status === 'RESOLVED' || inc.status === 'CLOSED' || inc.status === 'COMPLETED'));
  }, [filteredIncidents]);

  const handleOpenDetail = (inc) => {
    setSelectedIncident(inc);
    setIsDetailOpen(true);
  };

  const handleUpdateIncident = async (updatedInc) => {
    try {
      await incidentApi.updateIncident(updatedInc.id, {
        status: updatedInc.status,
        priority: updatedInc.priority,
        assignedUnit: updatedInc.assignedUnit,
        notes: updatedInc.notes,
      });
      fetchRealIncidents(true);
      setDashboardBanner(`Incident ${updatedInc.id} updated in database.`);
      setTimeout(() => setDashboardBanner(''), 3000);
    } catch (err) {
      console.warn('[IncidentsPage] Failed to update incident:', err.message);
    }
  };

  const handleConfirmDeleteActiveIncident = async () => {
    if (!incidentToDelete) return;
    const targetId = incidentToDelete.id || incidentToDelete._id || incidentToDelete.rawDoc?._id;
    setIsDeletingActiveIncident(true);

    try {
      await incidentApi.deleteIncident(targetId);
      setClearNotification({
        type: 'success',
        message: `Active incident ${incidentToDelete.id} deleted successfully.`,
      });
      setIncidentToDelete(null);
      setIsDeletingActiveIncident(false);

      // Remove ONLY that selected active incident from state
      setIncidents((prev) => prev.filter((item) => (item._id || item.id || item.packetId) !== targetId));

      // Refresh background records from server
      fetchRealIncidents(true);
    } catch (err) {
      console.error('Failed to delete active incident:', err);
      setIsDeletingActiveIncident(false);
      setClearNotification({
        type: 'error',
        message: err?.message || `Failed to delete active incident ${incidentToDelete.id}. Please try again.`,
      });
    } finally {
      setTimeout(() => setClearNotification(null), 5000);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant/60 pb-4">
        <div>
          {isOpenedFromDashboard && (
            <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-medium mb-1">
              <Link to="/dashboard" className="hover:text-primary transition-colors flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">dashboard</span>
                <span>Dashboard</span>
              </Link>
              <span>→</span>
              <span>Incidents</span>
              <span>→</span>
              <span className="font-bold text-secondary flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">warning</span>
                <span>Manage Incident ({activeIncidentId || 'Selected'})</span>
              </span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-2xl">grid_view</span>
            <h1 className="text-xl font-black text-primary uppercase tracking-wider">
              Emergency Incident Workspace
            </h1>
          </div>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Operational Triage & Dispatch ({incidents.length} Real Records Loaded)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => fetchRealIncidents()} className="min-h-[40px]">
            <span className="material-symbols-outlined text-base">refresh</span>
            <span>Refresh Workspace</span>
          </Button>
        </div>
      </div>

      {dashboardBanner && (
        <div className="p-3 rounded-xl bg-success/15 border border-success/30 text-success text-xs font-bold flex items-center justify-between animate-fade-in shadow-sm">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base">check_circle</span>
            <span>{dashboardBanner}</span>
          </div>
          <span className="text-[10px] font-mono text-on-surface-variant">Auto-closing banner</span>
        </div>
      )}

      {clearNotification && (
        <div
          className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between animate-fade-in shadow-sm border ${
            clearNotification.type === 'success'
              ? 'bg-success/15 border-success/30 text-success'
              : clearNotification.type === 'error'
              ? 'bg-error/15 border-error/30 text-error'
              : 'bg-info/15 border-info/30 text-info'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base">
              {clearNotification.type === 'success' ? 'check_circle' : clearNotification.type === 'error' ? 'error' : 'info'}
            </span>
            <span>{clearNotification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setClearNotification(null)}
            className="text-[10px] font-mono font-bold opacity-75 hover:opacity-100 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter & Search Bar */}
      <Card className="p-4 border border-outline-variant/60 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Keyword Search */}
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-base">
              search
            </span>
            <input
              type="text"
              placeholder="Search ID, Citizen, Location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-surface-container border border-outline-variant text-xs text-primary focus:outline-none focus:border-secondary min-h-[40px]"
            />
          </div>

          {/* Priority Filter */}
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-3 py-2 rounded-xl bg-surface-container border border-outline-variant text-xs text-primary focus:outline-none focus:border-secondary min-h-[40px]"
          >
            <option value="ALL">All Priorities</option>
            <option value="CRITICAL">🔴 Critical</option>
            <option value="HIGH">🟠 High Priority</option>
            <option value="MEDIUM">🟡 Medium Priority</option>
            <option value="LOW">🔵 Low Priority</option>
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 rounded-xl bg-surface-container border border-outline-variant text-xs text-primary focus:outline-none focus:border-secondary min-h-[40px]"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Incidents</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="RESOLVED">Completed / Resolved</option>
          </select>

          {/* Category Filter */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 rounded-xl bg-surface-container border border-outline-variant text-xs text-primary focus:outline-none focus:border-secondary min-h-[40px]"
          >
            <option value="ALL">All Categories</option>
            <option value="FLOOD">Flood & Water Submersion</option>
            <option value="FIRE">Fire Hazard & Explosion</option>
            <option value="COLLAPSE">Building & Structural Collapse</option>
            <option value="MEDICAL">Medical Emergency</option>
            <option value="STORM">Cyclone & Storm Hazard</option>
          </select>
        </div>
      </Card>

      {/* SECTION 1: Active Triage Queue Table */}
      <Card className="p-0 border border-outline-variant/60 shadow-md overflow-hidden space-y-0">
        <div className="p-3.5 bg-surface-container border-b border-outline-variant/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-base">emergency_home</span>
            <h2 className="text-sm font-black text-primary tracking-tight">Active Incident Queue ({activeIncidents.length})</h2>
          </div>
          <span className="text-[10px] font-mono text-on-surface-variant">Live Dispatch Telemetry</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-container-high border-b border-outline-variant/60 text-[10px] uppercase font-mono font-bold text-on-surface-variant">
              <tr>
                <th className="p-3">Incident ID</th>
                <th className="p-3">Category</th>
                <th className="p-3">Priority</th>
                <th className="p-3">Status</th>
                <th className="p-3">Location</th>
                <th className="p-3">Time Received</th>
                <th className="p-3">Assigned Unit</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40">
              {isLoading && activeIncidents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-on-surface-variant font-medium">
                    Loading live incidents from server...
                  </td>
                </tr>
              ) : activeIncidents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-on-surface-variant font-medium">
                    No active emergency incidents found matching filter.
                  </td>
                </tr>
              ) : (
                activeIncidents.map((inc) => (
                  <tr
                    key={inc.id}
                    className={`hover:bg-surface-container-high/50 transition-colors ${
                      highlightedId === inc.id ? 'bg-secondary/15 ring-2 ring-secondary/50' : ''
                    }`}
                  >
                    <td className="p-3 font-mono font-extrabold text-secondary">{inc.displayId || inc.id}</td>
                    <td className="p-3 font-bold text-primary">{inc.category}</td>
                    <td className="p-3">
                      <span className={`text-[9px] font-mono font-extrabold px-2.5 py-0.5 rounded-md ${inc.priorityBadge}`}>
                        {inc.priority}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`text-[9px] font-mono font-extrabold px-2 py-0.5 rounded-full ${inc.statusBadge}`}>
                        {inc.status}
                      </span>
                    </td>
                    <td className="p-3 font-medium text-primary">{inc.location}</td>
                    <td className="p-3 font-mono text-[10px] text-on-surface-variant">{inc.time}</td>
                    <td className="p-3 font-mono text-[10px] text-primary">{inc.assignedUnit}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleOpenDetail(inc)}
                          className="text-[10px] py-1 px-2.5 font-bold"
                        >
                          Manage & Dispatch
                        </Button>

                        {/* Delete Single Selected Active Incident Button */}
                        <button
                          type="button"
                          onClick={() => setIncidentToDelete(inc)}
                          className="p-1.5 rounded-lg bg-error/10 hover:bg-error/20 border border-error/30 text-error cursor-pointer transition-all active:scale-95 flex items-center justify-center shrink-0"
                          title={`Delete active incident ${inc.displayId || inc.id}`}
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* SECTION 2: Completed Incidents History Table */}
      <Card className="p-0 border border-success/30 shadow-md overflow-hidden space-y-0">
        <div className="p-3.5 bg-success/10 border-b border-success/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-success text-base">task_alt</span>
            <h2 className="text-sm font-black text-primary tracking-tight">Completed Incidents Archive ({completedIncidents.length})</h2>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono font-bold text-success bg-success/20 px-2.5 py-0.5 rounded-full border border-success/40">
              Resolved Mission Logs
            </span>

            {/* Clear History Button */}
            <button
              type="button"
              onClick={() => {
                if (completedIncidents.length === 0) {
                  setClearNotification({ type: 'info', message: 'No completed incidents to clear.' });
                  setTimeout(() => setClearNotification(null), 4000);
                } else {
                  setIsClearModalOpen(true);
                }
              }}
              className="py-1.5 px-3 rounded-lg bg-error/10 hover:bg-error/20 border border-error/30 text-error font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 focus:outline-none"
              title="Clear all completed incident history"
            >
              <span className="material-symbols-outlined text-sm">delete_sweep</span>
              <span>Clear History</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-container border-b border-outline-variant/60 text-[10px] uppercase font-mono font-bold text-on-surface-variant">
              <tr>
                <th className="p-3">Incident ID</th>
                <th className="p-3">Category</th>
                <th className="p-3">Priority</th>
                <th className="p-3">Received Time</th>
                <th className="p-3">Completed Time</th>
                <th className="p-3">Duration</th>
                <th className="p-3">Completed By</th>
                <th className="p-3">Resolution Summary</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40">
              {completedIncidents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-on-surface-variant font-medium">
                    No completed incidents logged in archive yet.
                  </td>
                </tr>
              ) : (
                completedIncidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-surface-container-high/50 transition-colors">
                    <td className="p-3 font-mono font-extrabold text-success">{inc.displayId || inc.id}</td>
                    <td className="p-3 font-bold text-primary">{inc.category}</td>
                    <td className="p-3">
                      <span className={`text-[9px] font-mono font-extrabold px-2.5 py-0.5 rounded-md ${inc.priorityBadge}`}>
                        {inc.priority}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-[10px] text-on-surface-variant">{inc.time}</td>
                    <td className="p-3 font-mono text-[10px] text-success font-bold">{inc.completedAt}</td>
                    <td className="p-3 font-mono text-[10px] text-secondary font-extrabold">{inc.resolutionDuration}</td>
                    <td className="p-3 font-medium text-primary">{inc.completedBy}</td>
                    <td className="p-3 text-on-surface-variant italic max-w-xs truncate" title={inc.resolutionSummary}>
                      "{inc.resolutionSummary}"
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenDetail(inc)}
                        className="text-[10px] py-1 px-2.5 font-bold"
                      >
                        View Record
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* CLEAR HISTORY CONFIRMATION MODAL */}
      {isClearModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-container-lowest border border-error/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 border-b border-outline-variant/60 pb-3">
              <div className="p-2.5 rounded-xl bg-error/15 text-error">
                <span className="material-symbols-outlined text-xl">warning</span>
              </div>
              <div>
                <h3 className="font-extrabold text-base text-primary">Clear Incident History</h3>
                <p className="text-xs text-on-surface-variant">Permanent Deletion Confirmation</p>
              </div>
            </div>

            <p className="text-xs text-primary font-medium leading-relaxed">
              This will permanently remove all completed incident history. Active incidents will <strong className="text-error uppercase">NOT</strong> be affected.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/60">
              <button
                type="button"
                disabled={isClearingHistory}
                onClick={() => setIsClearModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-primary font-bold text-xs cursor-pointer transition-all border border-outline-variant/60"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isClearingHistory}
                onClick={handleConfirmClearHistory}
                className="px-4 py-2 rounded-xl bg-error hover:brightness-110 text-white font-extrabold text-xs cursor-pointer transition-all shadow-md active:scale-95 flex items-center gap-1.5"
              >
                {isClearingHistory ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Clearing...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">delete_forever</span>
                    <span>Clear History</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE ACTIVE INCIDENT CONFIRMATION MODAL */}
      {incidentToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-container-lowest border border-error/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-left">
            <div className="flex items-center gap-3 border-b border-outline-variant/60 pb-3">
              <div className="p-2.5 rounded-xl bg-error/15 text-error">
                <span className="material-symbols-outlined text-xl">delete</span>
              </div>
              <div>
                <h3 className="font-extrabold text-base text-primary">Delete Active Incident</h3>
                <p className="text-xs text-on-surface-variant">Permanent Deletion Confirmation</p>
              </div>
            </div>

            <p className="text-xs text-primary font-medium leading-relaxed">
              Are you sure you want to permanently delete this active incident (<strong className="text-error font-mono">{incidentToDelete.id}</strong>)?
              <br />
              This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/60">
              <button
                type="button"
                disabled={isDeletingActiveIncident}
                onClick={() => setIncidentToDelete(null)}
                className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-primary font-bold text-xs cursor-pointer transition-all border border-outline-variant/60"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isDeletingActiveIncident}
                onClick={handleConfirmDeleteActiveIncident}
                className="px-4 py-2 rounded-xl bg-error hover:brightness-110 text-white font-extrabold text-xs cursor-pointer transition-all shadow-md active:scale-95 flex items-center gap-1.5"
              >
                {isDeletingActiveIncident ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">delete_forever</span>
                    <span>Delete Incident</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Incident Detail Modal */}
      <IncidentDetailModal
        incident={selectedIncident}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onUpdateIncident={handleUpdateIncident}
      />
    </div>
  );
}
