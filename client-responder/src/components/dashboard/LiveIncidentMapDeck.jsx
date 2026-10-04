import { useState, useMemo } from 'react';
import Card from '../ui/Card';
import LiveIncidentRadar from './LiveIncidentRadar';
import { getAuthoritativeIncidentCategory } from '../../utils/mapIncidentNormalizer';

const MAP_CONTROLS = [
  { id: 'ALL', label: 'All' },
  { id: 'CRITICAL', label: 'Critical' },
  { id: 'HIGH', label: 'High' },
  { id: 'WEATHER', label: 'Weather' },
  { id: 'MEDICAL', label: 'Medical' },
  { id: 'FIRE', label: 'Fire' },
  { id: 'FLOOD', label: 'Flood' },
  { id: 'OTHER', label: 'Other' },
];

export default function LiveIncidentMapDeck({
  incidents = [],
  clusters = [],
  focusTarget = null,
  onSelectIncident,
  onSelectCluster,
}) {
  const [activeFilter, setActiveFilter] = useState('ALL');

  // Compute filtered incidents based on the active control
  const filteredIncidents = useMemo(() => {
    if (activeFilter === 'ALL') return incidents;

    return incidents.filter((inc) => {
      const sev = (inc.severity || inc.priority || inc.aiAnalysis?.severity || 'MEDIUM').toUpperCase();
      const cat = getAuthoritativeIncidentCategory(inc).toUpperCase();

      if (activeFilter === 'CRITICAL') {
        return ['CRITICAL', 'LEVEL_4', 'LEVEL_5', 'EMERGENCY'].includes(sev);
      }
      if (activeFilter === 'HIGH') {
        return ['HIGH', 'WARNING', 'LEVEL_3'].includes(sev);
      }
      if (activeFilter === 'WEATHER') {
        return (
          cat.includes('WEATHER') ||
          cat.includes('STORM') ||
          cat.includes('CYCLONE') ||
          cat.includes('RAIN') ||
          cat.includes('WIND') ||
          cat.includes('HEAT') ||
          cat.includes('COLD') ||
          cat.includes('LIGHTNING') ||
          cat.includes('THUNDER') ||
          cat.includes('MONSOON') ||
          cat.includes('DROUGHT') ||
          cat.includes('SMOG')
        );
      }
      if (activeFilter === 'MEDICAL') {
        return cat.includes('MEDIC') || cat.includes('HEALTH') || cat.includes('CASUALTY') || cat.includes('COLLAPSE');
      }
      if (activeFilter === 'FIRE') {
        return cat.includes('FIRE') || cat.includes('HEAT') || cat.includes('EXPLOSION');
      }
      if (activeFilter === 'FLOOD') {
        return cat.includes('FLOOD') || cat.includes('RAIN') || cat.includes('WATERLOG') || cat.includes('INUNDATION');
      }
      if (activeFilter === 'OTHER') {
        const isKnown =
          cat.includes('WEATHER') ||
          cat.includes('STORM') ||
          cat.includes('CYCLONE') ||
          cat.includes('WIND') ||
          cat.includes('COLD') ||
          cat.includes('LIGHTNING') ||
          cat.includes('THUNDER') ||
          cat.includes('MONSOON') ||
          cat.includes('DROUGHT') ||
          cat.includes('SMOG') ||
          cat.includes('MEDIC') ||
          cat.includes('HEALTH') ||
          cat.includes('CASUALTY') ||
          cat.includes('COLLAPSE') ||
          cat.includes('FIRE') ||
          cat.includes('HEAT') ||
          cat.includes('EXPLOSION') ||
          cat.includes('FLOOD') ||
          cat.includes('RAIN') ||
          cat.includes('WATERLOG') ||
          cat.includes('INUNDATION');
        return !isKnown;
      }
      return true;
    });
  }, [incidents, activeFilter]);

  // Compute filtered clusters based on the active control
  const filteredClusters = useMemo(() => {
    if (activeFilter === 'ALL') return clusters;

    return clusters.filter((c) => {
      const prio = (c.highestPriority || c.priority || 'HIGH').toUpperCase();
      const dom = (c.dominantHazard || '').toUpperCase();

      if (activeFilter === 'CRITICAL') {
        return ['CRITICAL', 'LEVEL_4', 'LEVEL_5'].includes(prio);
      }
      if (activeFilter === 'HIGH') {
        return ['HIGH', 'WARNING', 'LEVEL_3'].includes(prio);
      }
      if (activeFilter === 'WEATHER') {
        return (
          dom.includes('WEATHER') ||
          dom.includes('STORM') ||
          dom.includes('CYCLONE') ||
          dom.includes('RAIN') ||
          dom.includes('WIND') ||
          dom.includes('HEAT') ||
          dom.includes('COLD') ||
          dom.includes('LIGHTNING') ||
          dom.includes('THUNDER') ||
          dom.includes('MONSOON') ||
          dom.includes('DROUGHT')
        );
      }
      if (activeFilter === 'MEDICAL') {
        return dom.includes('MEDIC') || dom.includes('HEALTH') || dom.includes('CASUALTY');
      }
      if (activeFilter === 'FIRE') {
        return dom.includes('FIRE') || dom.includes('HEAT');
      }
      if (activeFilter === 'FLOOD') {
        return dom.includes('FLOOD') || dom.includes('RAIN') || dom.includes('WATER');
      }
      if (activeFilter === 'OTHER') {
        const isKnown =
          dom.includes('WEATHER') ||
          dom.includes('STORM') ||
          dom.includes('CYCLONE') ||
          dom.includes('RAIN') ||
          dom.includes('WIND') ||
          dom.includes('HEAT') ||
          dom.includes('COLD') ||
          dom.includes('LIGHTNING') ||
          dom.includes('MEDIC') ||
          dom.includes('HEALTH') ||
          dom.includes('CASUALTY') ||
          dom.includes('FIRE') ||
          dom.includes('FLOOD') ||
          dom.includes('WATER');
        return !isKnown;
      }
      return true;
    });
  }, [clusters, activeFilter]);

  // Count items per filter pill for responder operational awareness
  const controlCounts = useMemo(() => {
    const counts = { ALL: incidents.length };
    incidents.forEach((inc) => {
      const sev = (inc.severity || inc.priority || inc.aiAnalysis?.severity || 'MEDIUM').toUpperCase();
      const cat = getAuthoritativeIncidentCategory(inc).toUpperCase();

      if (['CRITICAL', 'LEVEL_4', 'LEVEL_5', 'EMERGENCY'].includes(sev)) {
        counts.CRITICAL = (counts.CRITICAL || 0) + 1;
      }
      if (['HIGH', 'WARNING', 'LEVEL_3'].includes(sev)) {
        counts.HIGH = (counts.HIGH || 0) + 1;
      }
      if (
        cat.includes('WEATHER') ||
        cat.includes('STORM') ||
        cat.includes('CYCLONE') ||
        cat.includes('RAIN') ||
        cat.includes('WIND') ||
        cat.includes('HEAT') ||
        cat.includes('COLD') ||
        cat.includes('LIGHTNING') ||
        cat.includes('THUNDER') ||
        cat.includes('MONSOON') ||
        cat.includes('DROUGHT') ||
        cat.includes('SMOG')
      ) {
        counts.WEATHER = (counts.WEATHER || 0) + 1;
      }
      if (cat.includes('MEDIC') || cat.includes('HEALTH') || cat.includes('CASUALTY') || cat.includes('COLLAPSE')) {
        counts.MEDICAL = (counts.MEDICAL || 0) + 1;
      }
      if (cat.includes('FIRE') || cat.includes('HEAT') || cat.includes('EXPLOSION')) {
        counts.FIRE = (counts.FIRE || 0) + 1;
      }
      if (cat.includes('FLOOD') || cat.includes('RAIN') || cat.includes('WATERLOG') || cat.includes('INUNDATION')) {
        counts.FLOOD = (counts.FLOOD || 0) + 1;
      }

      const isKnown =
        cat.includes('WEATHER') ||
        cat.includes('STORM') ||
        cat.includes('CYCLONE') ||
        cat.includes('WIND') ||
        cat.includes('COLD') ||
        cat.includes('LIGHTNING') ||
        cat.includes('THUNDER') ||
        cat.includes('MONSOON') ||
        cat.includes('DROUGHT') ||
        cat.includes('SMOG') ||
        cat.includes('MEDIC') ||
        cat.includes('HEALTH') ||
        cat.includes('CASUALTY') ||
        cat.includes('COLLAPSE') ||
        cat.includes('FIRE') ||
        cat.includes('HEAT') ||
        cat.includes('EXPLOSION') ||
        cat.includes('FLOOD') ||
        cat.includes('RAIN') ||
        cat.includes('WATERLOG') ||
        cat.includes('INUNDATION');
      if (!isKnown) {
        counts.OTHER = (counts.OTHER || 0) + 1;
      }
    });
    return counts;
  }, [incidents]);

  return (
    <Card className="p-4 sm:p-5 border border-outline-variant/70 shadow-md space-y-3.5 bg-surface text-left">
      {/* Header & Controls bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-secondary/15 flex items-center justify-center text-secondary">
            <span className="material-symbols-outlined text-lg">explore</span>
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-primary leading-tight">
              Live Incident Map
            </h2>
            <p className="text-xs text-on-surface-variant font-mono">
              Operational spatial distribution • {filteredIncidents.length} active markers
            </p>
          </div>
        </div>

        {/* 7 Simple Pill Controls */}
        <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Map filters">
          {MAP_CONTROLS.map((ctrl) => {
            const isActive = activeFilter === ctrl.id;
            const count = controlCounts[ctrl.id] ?? 0;

            let activeColor = 'bg-secondary text-on-secondary shadow-xs font-bold';
            if (ctrl.id === 'CRITICAL') {
              activeColor = 'bg-error text-white font-black shadow-xs';
            } else if (ctrl.id === 'HIGH') {
              activeColor = 'bg-amber-600 text-white font-bold shadow-xs';
            }

            return (
              <button
                key={ctrl.id}
                onClick={() => setActiveFilter(ctrl.id)}
                type="button"
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? activeColor
                    : 'bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant/60'
                }`}
              >
                <span>{ctrl.label}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-black/25 text-white' : 'bg-surface text-on-surface-variant'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Primary Map Radar View */}
      <div id="live-incident-radar-section" className="rounded-xl overflow-hidden border border-outline-variant/60">
        <LiveIncidentRadar
          incidents={filteredIncidents}
          clusters={filteredClusters}
          focusTarget={focusTarget}
          onSelectIncident={onSelectIncident}
          onSelectCluster={onSelectCluster}
        />
      </div>
    </Card>
  );
}
