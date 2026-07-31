import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { incidentApi } from '../services/api';
import useSocket from '../hooks/useSocket';
import { RESPONDER_ROUTES } from '../constants/routes';
import IncidentDetailModal from '../components/incidents/IncidentDetailModal';
import LiveIncidentRadar from '../components/dashboard/LiveIncidentRadar';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const [incidents, setIncidents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Direct In-Dashboard Manage Workspace Modal State
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const { lastSocketEvent } = useSocket(true);

  // Clock Ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch REAL Incidents from Backend API
  const fetchDashboardIncidents = async (isBackground = false) => {
    if (!isBackground) setIsLoading(true);
    try {
      const res = await incidentApi.getIncidents();
      const rawList = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : res?.data?.incidents || res?.data?.data || [];
      setIncidents(rawList);
    } catch (err) {
      console.warn('[DashboardPage] Failed to fetch real incidents:', err.message);
      setIncidents([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    fetchDashboardIncidents(false);
    const interval = setInterval(() => {
      if (isMounted) fetchDashboardIncidents(true);
    }, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Real-Time Socket.IO event listener for instant updates without page refresh
  useEffect(() => {
    if (lastSocketEvent) {
      if (['INCIDENT_CREATED', 'NEW_EMERGENCY', 'INCIDENT_UPDATED', 'RELAY_UPDATED'].includes(lastSocketEvent.type)) {
        fetchDashboardIncidents(true);
      }
    }
  }, [lastSocketEvent]);

  // Robust field extractors
  const getSeverity = (inc) =>
    (inc.severity || inc.priority || inc.aiAnalysis?.severity || inc.aiAnalysis?.priority || 'MEDIUM').toUpperCase();

  const getStatus = (inc) =>
    (inc.status || inc.packetStatus || 'ACTIVE').toUpperCase();

  // Compute Live High-Level Metrics
  const totalCount = useMemo(() => incidents.length, [incidents]);

  const criticalCount = useMemo(
    () => incidents.filter((i) => getSeverity(i) === 'CRITICAL').length,
    [incidents]
  );

  const highCount = useMemo(
    () => incidents.filter((i) => ['HIGH', 'WARNING', 'MODERATE'].includes(getSeverity(i))).length,
    [incidents]
  );

  const activeCount = useMemo(
    () => incidents.filter((i) => !['RESOLVED', 'CLOSED'].includes(getStatus(i))).length,
    [incidents]
  );

  const completedCount = useMemo(
    () => incidents.filter((i) => ['RESOLVED', 'CLOSED'].includes(getStatus(i))).length,
    [incidents]
  );

  // Top 5 Urgent Active Incidents (Sorted Newest First)
  const recentCriticalIncidents = useMemo(() => {
    return incidents
      .slice()
      .sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : (a.timestamp ? new Date(a.timestamp).getTime() : 0);
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : (b.timestamp ? new Date(b.timestamp).getTime() : 0);
        return timeB - timeA;
      })
      .slice(0, 5);
  }, [incidents]);

  // Geographic Disaster Sector Distribution Overview
  const sectorDistribution = useMemo(() => {
    if (!incidents.length) return [];
    const counts = {};
    incidents.forEach((i) => {
      const sec = i.sector || i.location?.address || 'GPS Location Active';
      counts[sec] = (counts[sec] || 0) + 1;
    });

    const total = incidents.length;
    return Object.entries(counts).map(([sector, count]) => ({
      sector,
      count,
      pct: Math.round((count / total) * 100),
    }));
  }, [incidents]);

  // Direct In-Dashboard Action Handler: Opens Manage Workspace Modal WITHOUT Navigating
  const handleManageWorkspace = (inc) => {
    const id = String(inc._id || inc.id || inc.packetId);
    const category = (inc.category || inc.type || inc.aiAnalysis?.disasterCategory || 'GENERAL').toUpperCase();
    const priority = getSeverity(inc);
    const status = getStatus(inc);
    const realLoc = inc.sector || inc.location?.address || (inc.location?.lat && inc.location?.lng ? `GPS: ${inc.location.lat.toFixed(4)}, ${inc.location.lng.toFixed(4)}` : 'Live Telemetry Location');
    const realUnit = inc.assignedResponders?.[0]?.name || inc.assignedUnit || 'Unassigned / Pending Dispatch';

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
  };

  const handleUpdateIncident = async (updatedDoc) => {
    try {
      await incidentApi.updateIncident(updatedDoc.id, {
        status: updatedDoc.status,
        priority: updatedDoc.priority,
        assignedUnit: updatedDoc.assignedUnit,
        notes: updatedDoc.notes,
      });
      fetchDashboardIncidents(true);
      setToastMessage(`Incident ${updatedDoc.id} updated successfully.`);
      setTimeout(() => setToastMessage(''), 3000);
    } catch (err) {
      console.warn('[DashboardPage] Failed to update incident:', err.message);
    }
  };

  const METRICS = [
    {
      id: 'total_incidents',
      label: 'Total Incidents',
      count: totalCount,
      trend: 'Real Database Count',
      icon: 'format_list_bulleted',
      color: 'text-primary',
      borderColor: 'border-outline-variant',
      bgColor: 'bg-surface-container',
    },
    {
      id: 'critical_incidents',
      label: 'Critical Incidents',
      count: criticalCount,
      trend: 'Level 4 & 5 Hazards',
      icon: 'emergency',
      color: 'text-error',
      borderColor: 'border-error/40',
      bgColor: 'bg-error/10',
    },
    {
      id: 'high_priority',
      label: 'High Priority',
      count: highCount,
      trend: 'Urgent Dispatch',
      icon: 'warning',
      color: 'text-amber-500',
      borderColor: 'border-amber-500/40',
      bgColor: 'bg-amber-500/10',
    },
    {
      id: 'active_operations',
      label: 'Active Operations',
      count: activeCount,
      trend: 'Active Field Operations',
      icon: 'local_shipping',
      color: 'text-secondary',
      borderColor: 'border-secondary/40',
      bgColor: 'bg-secondary/10',
    },
    {
      id: 'completed_missions',
      label: 'Completed Missions',
      count: completedCount,
      trend: 'Resolved Emergencies',
      icon: 'task_alt',
      color: 'text-success',
      borderColor: 'border-success/40',
      bgColor: 'bg-success/10',
    },
  ];

  return (
    <div className="space-y-6 text-left animate-fade-in pb-4">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-primary tracking-tight">
              Emergency Command Overview
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold uppercase bg-secondary/15 text-secondary border border-secondary/30">
              {role || 'COMMANDER'} ACTIVE
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Operational Disaster Command Center • Live Incident Radar Triage
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="text-right font-mono hidden sm:block">
            <span className="text-xs font-bold text-primary block leading-none">{currentTime}</span>
            <span className="text-[9px] text-on-surface-variant block mt-0.5">UTC+05:30 IST</span>
          </div>
          <Button variant="primary" size="sm" onClick={() => navigate(RESPONDER_ROUTES.INCIDENTS)} className="min-h-[40px] font-bold">
            <span className="material-symbols-outlined text-base">warning</span>
            <span>All Incidents Page ➔</span>
          </Button>
          <Button variant="secondary" size="sm" onClick={() => fetchDashboardIncidents(false)} className="min-h-[40px]">
            <span className="material-symbols-outlined text-base">refresh</span>
          </Button>
        </div>
      </div>

      {toastMessage && (
        <div className="p-3 rounded-xl bg-success/15 border border-success/30 text-success text-xs font-bold flex items-center gap-2 animate-fade-in shadow-sm">
          <span className="material-symbols-outlined text-base">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 5 Operational Summary Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {METRICS.map((m) => (
          <Card key={m.id} className={`p-4 border ${m.borderColor} ${m.bgColor} shadow-sm space-y-2`}>
            <div className="flex items-center justify-between">
              <span className={`material-symbols-outlined text-xl ${m.color}`}>{m.icon}</span>
              <span className="text-[10px] font-mono text-on-surface-variant font-bold truncate max-w-[90px]">
                {m.trend}
              </span>
            </div>
            <div>
              <span className={`text-2xl font-black font-mono block ${m.color}`}>{m.count}</span>
              <span className="text-[11px] font-bold text-on-surface-variant block mt-0.5">{m.label}</span>
            </div>
          </Card>
        ))}
      </div>

      {/* LIVE INCIDENT RADAR VISUALIZATION */}
      <LiveIncidentRadar
        incidents={incidents}
        onSelectIncident={(inc) => handleManageWorkspace(inc)}
      />

      {/* High-Level Overview Grid: Recent Critical Incidents & Geographic Sector Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top 5 Urgent Critical Incidents Overview List */}
        <Card className="lg:col-span-2 p-5 border border-outline-variant/60 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-outline-variant/60 pb-3">
            <div>
              <h2 className="text-base font-black text-primary leading-tight">
                Top Urgent Incidents Overview ({recentCriticalIncidents.length})
              </h2>
              <p className="text-xs text-on-surface-variant">Click 'Manage Workspace' to open details directly in Dashboard</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => navigate(RESPONDER_ROUTES.INCIDENTS)} className="text-xs">
              View All Workspace ➔
            </Button>
          </div>

          <div className="space-y-3">
            {isLoading ? (
              <p className="text-xs font-mono font-bold text-secondary text-center py-6">
                Fetching real backend incidents...
              </p>
            ) : recentCriticalIncidents.length === 0 ? (
              <p className="text-xs text-on-surface-variant text-center py-6">
                No active emergency incidents recorded in database.
              </p>
            ) : (
              recentCriticalIncidents.map((inc) => {
                const id = inc._id || inc.id || inc.packetId;
                const category = (inc.category || inc.type || inc.aiAnalysis?.disasterCategory || 'GENERAL').toUpperCase();
                const priority = getSeverity(inc);
                const status = getStatus(inc);

                let badgeColor = 'bg-secondary text-white';
                if (priority === 'CRITICAL') badgeColor = 'bg-error text-white font-bold';
                else if (priority === 'HIGH' || priority === 'WARNING') badgeColor = 'bg-amber-500 text-white font-bold';

                return (
                  <div key={id} className="p-3 rounded-xl bg-surface-container border border-outline-variant/60 flex flex-wrap items-center justify-between gap-3 hover:bg-surface-container-high/60 transition-colors">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-primary text-xs">{category}</span>
                        <span className={`text-[9px] font-mono px-2 py-0.5 rounded ${badgeColor}`}>
                          {priority}
                        </span>
                        <span className="text-[10px] font-mono text-on-surface-variant">STATUS: {status}</span>
                      </div>
                      <p className="text-xs text-on-surface-variant font-medium">
                        Location: <strong className="text-primary">{inc.sector || inc.location?.address || 'Sector 4'}</strong> • ID: <span className="font-mono text-secondary">{String(id).substring(0, 14)}</span>
                      </p>
                    </div>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleManageWorkspace(inc)}
                      className="text-[10px] py-1.5 px-3 font-bold"
                    >
                      Manage Workspace
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Geographic Sector & Hazard Overview */}
        <Card className="p-5 border border-outline-variant/60 shadow-md space-y-4">
          <div className="border-b border-outline-variant/60 pb-3">
            <h2 className="text-base font-black text-primary leading-tight">
              Sector Distribution Overview
            </h2>
            <p className="text-xs text-on-surface-variant">Live incident concentration by sector</p>
          </div>

          {isLoading ? (
            <p className="text-xs font-mono font-bold text-secondary text-center py-6">Loading sector metrics...</p>
          ) : sectorDistribution.length === 0 ? (
            <p className="text-xs text-on-surface-variant text-center py-6">No location data recorded.</p>
          ) : (
            <div className="space-y-3">
              {sectorDistribution.map((sec) => (
                <div key={sec.sector} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-primary">{sec.sector}</span>
                    <span className="font-mono text-secondary">{sec.count} Incident(s) ({sec.pct}%)</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden">
                    <div className="h-full bg-secondary transition-all duration-500" style={{ width: `${sec.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick Actions Footer */}
          <div className="pt-3 border-t border-outline-variant/40 space-y-2">
            <span className="text-[10px] font-mono font-extrabold text-on-surface-variant uppercase block">Quick Action Links</span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Button variant="secondary" size="sm" onClick={() => navigate(RESPONDER_ROUTES.INCIDENTS)} className="text-[10px] py-1.5">
                Incidents Page
              </Button>
              <Button variant="secondary" size="sm" onClick={() => navigate(RESPONDER_ROUTES.RESOURCES)} className="text-[10px] py-1.5">
                Resource Fleet
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Direct In-Dashboard Manage Workspace Component / Modal */}
      <IncidentDetailModal
        incident={selectedIncident}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onUpdateIncident={handleUpdateIncident}
      />
    </div>
  );
}
