import { useState } from 'react';
import Card from '../components/ui/Card';
import StatusChip from '../components/ui/StatusChip';
import Button from '../components/ui/Button';
import WhyReasoningPanel from '../components/cards/WhyReasoningPanel';
import ResourceRecommendationCard from '../components/cards/ResourceRecommendationCard';
import { cn } from '../utils/helpers';

export default function IncidentIntelligencePage() {
  const [activeFilter, setActiveFilter] = useState('all');

  const incidents = [
    { id: 1, title: 'Seismic Activity — Sector 7', severity: 'critical', time: '14:22 UTC', description: 'Magnitude 6.2. Infrastructure at risk. Evacuation recommended.', responders: 12 },
    { id: 2, title: 'Flood Warning — River Basin Alpha', severity: 'warning', time: '13:08 UTC', description: 'Water levels rising rapidly. Threshold breach predicted at 14:00.', responders: 8 },
    { id: 3, title: 'Structural Compromise — Bridge 9', severity: 'critical', time: '12:45 UTC', description: 'Integrity at 42%. Load restrictions applied.', responders: 6 },
  ];

  const filteredIncidents = incidents.filter((inc) => {
    if (activeFilter === 'all') return true;
    return inc.severity === activeFilter;
  });

  return (
    <div className="space-y-6">
      {/* Page Title & Quick Action */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-headline-lg font-bold text-primary">Incident Intelligence</h1>
          <p className="text-body-md text-on-surface-variant mt-0.5">Real-time incident evaluation & Gemma 4 reasoning</p>
        </div>
        <Button variant="primary" icon="add">New Incident</Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-outline-variant/60 pb-3">
        <span className="text-xs font-bold uppercase text-on-surface-variant tracking-wider mr-2">Filter:</span>
        {['all', 'critical', 'warning'].map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border',
              activeFilter === f
                ? 'bg-primary text-white border-primary shadow-xs'
                : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/60 hover:bg-surface-container-low'
            )}
          >
            {f === 'all' ? 'All Incidents' : f}
          </button>
        ))}
      </div>

      {/* Main Grid: Active Incidents List & Why Reasoning Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Active Incidents Column */}
        <div className="lg:col-span-7 space-y-4">
          <h3 className="text-body-lg font-bold text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">warning</span>
            Active Incidents ({filteredIncidents.length})
          </h3>
          {filteredIncidents.map((inc) => (
            <Card key={inc.id} variant={inc.severity === 'critical' ? 'emergency' : 'warning'} className="p-5">
              <div className="flex justify-between items-start mb-3">
                <StatusChip label={inc.severity} variant={inc.severity} dot />
                <span className="text-mono-data text-on-surface-variant text-xs">{inc.time}</span>
              </div>
              <h3 className="text-headline-md font-bold text-primary mb-2">{inc.title}</h3>
              <p className="text-sm text-on-surface-variant mb-4 leading-relaxed">{inc.description}</p>
              <div className="flex items-center justify-between pt-3 border-t border-outline-variant/40">
                <span className="text-label-sm text-on-surface-variant uppercase flex items-center gap-1 font-semibold">
                  <span className="material-symbols-outlined text-[16px]">groups</span>
                  {inc.responders} responders assigned
                </span>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm">View Details</Button>
                  <Button variant="secondary" size="sm" icon="map" title="View Map" />
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Why Reasoning Panel Column */}
        <div className="lg:col-span-5 space-y-6">
          <WhyReasoningPanel />

          <div className="space-y-3">
            <h3 className="text-body-lg font-bold text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">alt_route</span>
              Resource Allocation Recommendations
            </h3>
            <ResourceRecommendationCard
              unitName="Alpha Squad Command"
              role="Search & Structural Rescue"
              sector="Sector 7 — Bridge 9"
              eta="12 min"
              priority="critical"
              reason="Pre-position for anticipated structural failure and immediate perimeter evacuation."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
