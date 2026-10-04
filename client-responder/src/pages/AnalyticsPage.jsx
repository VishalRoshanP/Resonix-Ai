import { useState, useEffect, useMemo, useRef } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { incidentApi } from '../services/api';

export default function AnalyticsPage() {
  const [incidents, setIncidents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');
  const [toastMsg, setToastMsg] = useState('');

  const isMountedRef = useRef(true);
  const activeControllerRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;
    fetchRealAnalytics(false);
    const interval = setInterval(() => {
      fetchRealAnalytics(true);
    }, 30000);
    return () => {
      isMountedRef.current = false;
      if (activeControllerRef.current) activeControllerRef.current.abort();
      clearInterval(interval);
    };
  }, []);

  const fetchRealAnalytics = async (isBackground = false) => {
    if (!isBackground && isMountedRef.current) setIsLoading(true);
    if (activeControllerRef.current) {
      activeControllerRef.current.abort();
    }
    const controller = new AbortController();
    activeControllerRef.current = controller;

    try {
      const res = await incidentApi.getIncidents({ signal: controller.signal });
      if (!isMountedRef.current) return;
      const rawList = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : res?.data?.incidents || res?.data?.data || [];
      setIncidents(rawList);
    } catch (err) {
      if (err.name === 'AbortError' || err.message?.includes('aborted')) return;
      console.warn('[AnalyticsPage] Failed to fetch analytics data:', err.message);
      if (isMountedRef.current) setIncidents([]);
    } finally {
      if (isMountedRef.current && !isBackground) {
        setIsLoading(false);
      }
    }
  };

  // Compute real category breakdown from real backend MongoDB incidents
  const categoryStats = useMemo(() => {
    if (!incidents.length) return [];
    const counts = {};
    incidents.forEach((i) => {
      const cat = (i.category || i.type || 'GENERAL').toUpperCase();
      counts[cat] = (counts[cat] || 0) + 1;
    });

    const colors = ['bg-blue-500', 'bg-orange-500', 'bg-red-500', 'bg-amber-600', 'bg-teal-600'];
    const total = incidents.length;

    return Object.entries(counts).map(([label, count], idx) => ({
      label,
      count,
      pct: Math.round((count / total) * 100),
      color: colors[idx % colors.length],
    }));
  }, [incidents]);

  // Compute real priority breakdown from real backend MongoDB incidents
  const priorityStats = useMemo(() => {
    if (!incidents.length) return [];
    const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    incidents.forEach((i) => {
      const p = (i.severity || i.priority || 'MEDIUM').toUpperCase();
      if (counts[p] !== undefined) counts[p]++;
      else counts.MEDIUM++;
    });

    const total = incidents.length;
    return [
      { label: 'Critical Triage', count: counts.CRITICAL, pct: Math.round((counts.CRITICAL / total) * 100), color: 'bg-error' },
      { label: 'High Priority', count: counts.HIGH, pct: Math.round((counts.HIGH / total) * 100), color: 'bg-amber-500' },
      { label: 'Medium Priority', count: counts.MEDIUM, pct: Math.round((counts.MEDIUM / total) * 100), color: 'bg-secondary' },
      { label: 'Low Priority', count: counts.LOW, pct: Math.round((counts.LOW / total) * 100), color: 'bg-surface-container-high' },
    ];
  }, [incidents]);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  return (
    <div className="space-y-6 text-left animate-fade-in pb-4">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant/60 pb-4">
        <div>
          <h1 className="text-2xl font-black text-primary tracking-tight">Command Operations Analytics</h1>
          <p className="text-xs text-on-surface-variant mt-0.5">Real-Time Ingestion Volume & Triage Metrics from Backend DB</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => fetchRealAnalytics(false)} className="min-h-[40px]">
            <span className="material-symbols-outlined text-base">refresh</span>
            <span>Refresh Real Analytics</span>
          </Button>
        </div>
      </div>

      {toastMsg && (
        <div className="p-3 rounded-xl bg-secondary/15 border border-secondary/30 text-primary text-xs font-bold flex items-center gap-2 animate-fade-in">
          <span className="material-symbols-outlined text-secondary text-base">info</span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border border-outline-variant/60 shadow-sm space-y-1">
          <span className="text-[10px] font-mono font-bold text-on-surface-variant uppercase">Total Database Incidents</span>
          <span className="text-2xl font-black font-mono text-primary block">{incidents.length}</span>
          <span className="text-[10px] font-bold text-secondary">Real MongoDB Records</span>
        </Card>

        <Card className="p-4 border border-error/30 bg-error/5 shadow-sm space-y-1">
          <span className="text-[10px] font-mono font-bold text-error uppercase">Critical Hazards</span>
          <span className="text-2xl font-black font-mono text-error block">
            {incidents.filter((i) => (i.severity || i.priority || '').toUpperCase() === 'CRITICAL').length}
          </span>
          <span className="text-[10px] font-bold text-error">Level 4 & 5 Emergencies</span>
        </Card>

        <Card className="p-4 border border-secondary/30 bg-secondary/5 shadow-sm space-y-1">
          <span className="text-[10px] font-mono font-bold text-secondary uppercase">Active Operations</span>
          <span className="text-2xl font-black font-mono text-secondary block">
            {incidents.filter((i) => ['ACTIVE', 'DISPATCHED', 'EN_ROUTE', 'ON_SCENE'].includes((i.status || '').toUpperCase())).length}
          </span>
          <span className="text-[10px] font-bold text-secondary">Dispatched Squad Units</span>
        </Card>

        <Card className="p-4 border border-success/30 bg-success/5 shadow-sm space-y-1">
          <span className="text-[10px] font-mono font-bold text-success uppercase">Resolved Incidents</span>
          <span className="text-2xl font-black font-mono text-success block">
            {incidents.filter((i) => ['RESOLVED', 'CLOSED'].includes((i.status || '').toUpperCase())).length}
          </span>
          <span className="text-[10px] font-bold text-success">Completed Missions</span>
        </Card>
      </div>

      {/* Category Breakdown & Priority Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5 border border-outline-variant/60 shadow-md space-y-4">
          <h2 className="text-sm font-black text-primary uppercase font-mono tracking-wider border-b border-outline-variant/60 pb-2">
            Disaster Category Distribution (Real DB)
          </h2>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8">
              <div className="w-5 h-5 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-mono font-bold text-secondary">Loading analytics from MongoDB...</p>
            </div>
          ) : categoryStats.length === 0 ? (
            <p className="text-xs text-on-surface-variant text-center py-6">No emergency incidents recorded in database.</p>
          ) : (
            <div className="space-y-3">
              {categoryStats.map((c) => (
                <div key={c.label} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-primary">{c.label}</span>
                    <span className="font-mono text-secondary">{c.count} Signals ({c.pct}%)</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-surface-container overflow-hidden">
                    <div className={`h-full ${c.color} transition-all duration-500`} style={{ width: `${c.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5 border border-outline-variant/60 shadow-md space-y-4">
          <h2 className="text-sm font-black text-primary uppercase font-mono tracking-wider border-b border-outline-variant/60 pb-2">
            Priority & Severity Triage (Real DB)
          </h2>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8">
              <div className="w-5 h-5 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-mono font-bold text-secondary">Loading analytics from MongoDB...</p>
            </div>
          ) : priorityStats.length === 0 ? (
            <p className="text-xs text-on-surface-variant text-center py-6">No priority data recorded.</p>
          ) : (
            <div className="space-y-3">
              {priorityStats.map((p) => (
                <div key={p.label} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-primary">{p.label}</span>
                    <span className="font-mono text-secondary">{p.count} Incidents ({p.pct}%)</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-surface-container overflow-hidden">
                    <div className={`h-full ${p.color} transition-all duration-500`} style={{ width: `${p.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
