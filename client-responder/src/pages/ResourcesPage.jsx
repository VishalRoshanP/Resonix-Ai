import { useState, useEffect, useMemo, useCallback } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import ResourceAssignModal from '../components/resources/ResourceAssignModal';
import { resourceApi } from '../services/api';
import useSocket from '../hooks/useSocket';

const FILTER_TABS = [
  { id: 'ALL', label: 'All Units' },
  { id: 'AVAILABLE', label: 'Available' },
  { id: 'ALLOCATED', label: 'Allocated' },
  { id: 'EN ROUTE', label: 'En Route' },
  { id: 'BUSY', label: 'Busy' },
  { id: 'OFFLINE', label: 'Offline' },
];

export default function ResourcesPage() {
  const [resourcesList, setResourcesList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [selectedResource, setSelectedResource] = useState(null);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const { lastSocketEvent } = useSocket(true);

  // Fetch REAL Operational Resources from Backend Database (Strict Zero Mock Data)
  const fetchRealResources = useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setIsLoading(true);
      setFetchError(null);
    }
    try {
      const data = await resourceApi.getResources({ signal: AbortSignal.timeout(10000) });
      const list = Array.isArray(data) ? data : (Array.isArray(data?.resources) ? data.resources : []);
      setResourcesList(list);
      setFetchError(null);
    } catch (err) {
      console.warn('[ResourcesPage] Error fetching resources from backend:', err.message);
      if (!isBackground || resourcesList.length === 0) {
        setFetchError('Data temporarily unavailable: Waiting for live backend data');
      }
    } finally {
      setIsLoading(false);
    }
  }, [resourcesList.length]);

  useEffect(() => {
    let isMounted = true;
    fetchRealResources(false);

    const interval = setInterval(() => {
      if (isMounted) fetchRealResources(true);
    }, 15000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [fetchRealResources]);

  // Real-Time Socket.IO event handler
  useEffect(() => {
    if (lastSocketEvent) {
      // Reconnect handler: fetch latest state after socket reconnection
      if (lastSocketEvent.type === 'SOCKET_RECONNECTED') {
        console.log('[ResourcesPage] 🔄 Socket reconnected. Fetching latest resource state...');
        fetchRealResources(true);
        return;
      }

      if (['RESOURCE_UPDATED', 'RESOURCE_ASSIGNED', 'INCIDENT_UPDATED', 'INCIDENT_CREATED'].includes(lastSocketEvent.type)) {
        if (lastSocketEvent.type === 'RESOURCE_UPDATED' && lastSocketEvent.resource) {
          const updated = lastSocketEvent.resource;
          const targetId = String(updated.id || updated._id);
          setResourcesList((prev) => {
            const exists = prev.some((r) => String(r.id || r._id) === targetId);
            if (exists) {
              return prev.map((r) => (String(r.id || r._id) === targetId ? { ...r, ...updated } : r));
            }
            return [updated, ...prev];
          });
        } else if (lastSocketEvent.type === 'RESOURCE_ASSIGNED') {
          // Update resource status when assigned to an incident
          const resId = String(lastSocketEvent.resourceId || lastSocketEvent.resource?.id || lastSocketEvent.resource?._id || '');
          if (resId) {
            setResourcesList((prev) =>
              prev.map((r) => String(r.id || r._id) === resId
                ? { ...r, status: 'ALLOCATED', currentMission: lastSocketEvent.incidentId || r.currentMission }
                : r
              )
            );
          }
          fetchRealResources(true);
        } else {
          fetchRealResources(true);
        }
      }
    }
  }, [lastSocketEvent, fetchRealResources]);

  // Functional Search & Status Filter against real database objects
  const filteredResources = useMemo(() => {
    return resourcesList.filter((res) => {
      const name = (res.name || '').toLowerCase();
      const type = (res.type || res.category || '').toLowerCase();
      const loc = (res.location || '').toLowerCase();
      const status = (res.status || 'AVAILABLE').toUpperCase();
      const mission = (res.currentMission || '').toLowerCase();
      const query = searchQuery.toLowerCase().trim();

      // Search match
      const matchesSearch =
        !query ||
        name.includes(query) ||
        type.includes(query) ||
        loc.includes(query) ||
        status.toLowerCase().includes(query) ||
        mission.includes(query);

      // Status filter match
      const matchesFilter =
        activeFilter === 'ALL' ||
        status === activeFilter ||
        (activeFilter === 'BUSY' && (status === 'BUSY' || status === 'ON SCENE'));

      return matchesSearch && matchesFilter;
    });
  }, [resourcesList, searchQuery, activeFilter]);

  // Status Badge Colors (Restrained Government Application Palette)
  const getStatusBadge = (status) => {
    const s = (status || 'AVAILABLE').toUpperCase();
    if (s === 'AVAILABLE') {
      return 'bg-emerald-600/15 border-emerald-500 text-emerald-600 font-bold';
    }
    if (s === 'ALLOCATED') {
      return 'bg-amber-500/15 border-amber-500 text-amber-600 font-bold';
    }
    if (s === 'EN ROUTE') {
      return 'bg-sky-500/15 border-sky-500 text-sky-600 font-bold';
    }
    if (s === 'ON SCENE' || s === 'BUSY') {
      return 'bg-purple-600/15 border-purple-500 text-purple-600 font-bold';
    }
    return 'bg-slate-500/15 border-slate-500 text-slate-500 font-medium';
  };

  const handleOpenAssign = (res) => {
    setSelectedResource(res);
    setIsAssignOpen(true);
  };

  const handleAssignComplete = (updatedRes) => {
    setToastMessage(`Resource '${updatedRes.name}' successfully allocated to ${updatedRes.currentMission || 'Incident'}.`);
    fetchRealResources(true);
    setTimeout(() => setToastMessage(''), 4000);
  };

  const handleReleaseUnit = async (res) => {
    const id = String(res.id || res._id);
    try {
      await resourceApi.releaseResource(id);
      setToastMessage(`Resource '${res.name}' released back to AVAILABLE status.`);
      fetchRealResources(true);
      setTimeout(() => setToastMessage(''), 3000);
    } catch (err) {
      console.warn('[ResourcesPage] Release error:', err.message);
    }
  };

  return (
    <div className="space-y-6 text-left animate-fade-in pb-4">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant/60 pb-4">
        <div>
          <h1 className="text-2xl font-black text-primary tracking-tight">Rescue Teams & Squad Deployments</h1>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Central Resource Management • Real Operational Database Records
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => fetchRealResources(false)} className="min-h-[40px]">
            <span className="material-symbols-outlined text-base">refresh</span>
            <span>Refresh Real Units</span>
          </Button>
        </div>
      </div>

      {toastMessage && (
        <div className="p-3 rounded-xl bg-success/15 border border-success/30 text-success text-xs font-bold flex items-center gap-2 animate-fade-in shadow-sm">
          <span className="material-symbols-outlined text-base">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Search Bar and Status Filter Tabs */}
      <div className="space-y-3">
        {/* Search Input */}
        <Card className="p-3.5 border border-outline-variant/60 shadow-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-on-surface-variant text-xl">search</span>
          <input
            type="text"
            placeholder="Search real resources by name, type, location, or status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-primary focus:outline-none font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-on-surface-variant hover:text-primary text-xs font-mono"
            >
              Clear
            </button>
          )}
        </Card>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
          {FILTER_TABS.map((tab) => {
            const isActive = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg border font-bold text-xs transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-secondary text-white border-secondary shadow-xs'
                    : 'bg-surface border-outline-variant text-on-surface-variant hover:border-secondary hover:text-primary'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Resource Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading && resourcesList.length === 0 ? (
          <div className="col-span-full p-12 text-center text-secondary font-mono font-bold flex flex-col items-center justify-center gap-2">
            <div className="w-5 h-5 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
            <span>Loading real operational resources from MongoDB...</span>
          </div>
        ) : fetchError && resourcesList.length === 0 ? (
          <div className="col-span-full p-12 text-center text-on-surface-variant font-medium bg-surface-container/50 rounded-xl border border-outline-variant/60 space-y-2">
            <span className="material-symbols-outlined text-3xl text-amber-500 block">cloud_off</span>
            <p className="text-sm font-bold text-primary">{fetchError}</p>
            <p className="text-xs text-on-surface-variant">Waiting for live backend resource fleet records</p>
            <Button variant="secondary" size="sm" onClick={() => fetchRealResources(false)} className="mt-2 text-xs">
              <span className="material-symbols-outlined text-xs mr-1">refresh</span>
              Retry Fleet Connection
            </Button>
          </div>
        ) : filteredResources.length === 0 ? (
          <div className="col-span-full p-12 text-center text-on-surface-variant font-medium bg-surface-container/50 rounded-xl border border-outline-variant/40 space-y-1">
            <span className="material-symbols-outlined text-3xl text-on-surface-variant/60 block">inventory_2</span>
            <p className="text-sm font-bold text-primary">No operational resources available.</p>
            <p className="text-xs text-on-surface-variant">
              {searchQuery || activeFilter !== 'ALL'
                ? 'Try adjusting your search query or status filter.'
                : 'Zero operational resources currently registered in database.'}
            </p>
          </div>
        ) : (
          filteredResources.map((res) => {
            const id = String(res.id || res._id);
            const displayId = id.length > 8 ? `RES-${id.slice(-4).toUpperCase()}` : id;
            const status = (res.status || 'AVAILABLE').toUpperCase();
            const isAvailable = status === 'AVAILABLE';
            const isAllocated = status === 'ALLOCATED' || status === 'EN ROUTE' || status === 'ON SCENE';

            return (
              <Card
                key={id}
                className="p-5 border border-outline-variant/60 shadow-md space-y-3 flex flex-col justify-between hover:border-secondary/60 transition-all"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="w-10 h-10 rounded-xl bg-secondary/15 border border-secondary/30 flex items-center justify-center text-secondary shrink-0">
                      <span className="material-symbols-outlined text-xl">{res.icon || 'shield'}</span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-mono border ${getStatusBadge(status)}`}>
                      {status}
                    </span>
                  </div>

                  <div>
                    <h2 className="text-sm font-black text-primary leading-tight">{res.name}</h2>
                    <span className="text-[10px] font-mono text-on-surface-variant font-bold block mt-0.5">
                      {displayId} • {res.type || res.category || 'General Resource'}
                    </span>
                  </div>

                  {/* Resource Operational Details Box */}
                  <div className="text-xs text-on-surface-variant space-y-1 font-medium bg-surface-container p-3 rounded-xl border border-outline-variant/40">
                    <p>
                      <strong className="text-primary">Capacity:</strong>{' '}
                      {res.capacity ? <span className="font-semibold text-primary">{res.capacity}</span> : <span className="italic text-on-surface-variant">Not available</span>}
                    </p>
                    <p>
                      <strong className="text-primary">Current mission:</strong>{' '}
                      {res.currentMission ? (
                        <span className="font-mono font-bold text-secondary">{res.currentMission}</span>
                      ) : (
                        <span className="italic text-on-surface-variant">Not available</span>
                      )}
                    </p>
                    <p>
                      <strong className="text-primary">Current location:</strong>{' '}
                      {res.location ? (
                        <span className="font-medium text-primary">{res.location}</span>
                      ) : (
                        <span className="italic text-on-surface-variant">Not available</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Tactical Dispatch & Release Actions */}
                <div className="pt-2 flex items-center gap-2">
                  {isAvailable ? (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleOpenAssign(res)}
                      className="w-full text-xs py-2 font-bold justify-center"
                    >
                      Assign Mission / Task Unit
                    </Button>
                  ) : isAllocated ? (
                    <div className="w-full grid grid-cols-2 gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled
                        className="text-[11px] py-1.5 opacity-60 cursor-not-allowed justify-center"
                      >
                        Allocated
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleReleaseUnit(res)}
                        className="text-[11px] py-1.5 font-bold hover:border-emerald-500 hover:text-emerald-600 justify-center"
                      >
                        Mark Available
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled
                      className="w-full text-xs py-2 opacity-50 cursor-not-allowed justify-center"
                    >
                      Unit Offline / Busy
                    </Button>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Tactical Resource Assignment Modal */}
      {isAssignOpen && selectedResource && (
        <ResourceAssignModal
          resource={selectedResource}
          isOpen={isAssignOpen}
          onClose={() => setIsAssignOpen(false)}
          onAssignComplete={handleAssignComplete}
        />
      )}
    </div>
  );
}
