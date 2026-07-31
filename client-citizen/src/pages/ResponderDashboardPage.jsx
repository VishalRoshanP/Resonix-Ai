import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import StatCard from '../components/cards/StatCard';
import Card from '../components/ui/Card';
import StatusChip from '../components/ui/StatusChip';
import Button from '../components/ui/Button';
import WhyReasoningPanel from '../components/cards/WhyReasoningPanel';
import ResourceRecommendationCard from '../components/cards/ResourceRecommendationCard';
import Timeline from '../components/data/Timeline';

export default function ResponderDashboardPage() {
  const navigate = useNavigate();

  const recentActivity = [
    { type: 'warning', title: 'Critical SOS Transmitted: Sector 7', description: 'Citizen #8841 requested immediate flood evacuation boat.', time: 'Just now' },
    { type: 'check', title: 'Alpha Squad Dispatched', description: 'ETA 12 minutes to Sector 7 perimeter.', time: '-4m' },
    { type: 'sync', title: 'Offline Mesh Node Hop Restored', description: 'Node 14 auto-routed packet stream.', time: '-18m' },
    { type: 'success', title: 'Bridge 9 Load Restriction Enforced', description: 'Traffic diverted via Route Bravo.', time: '-32m' },
  ];

  return (
    <div className="space-y-6 text-left">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4 border-b border-outline-variant/60 pb-4">
        <div>
          <h1 className="text-headline-lg font-extrabold text-primary">Command Center Dashboard</h1>
          <p className="text-body-md text-on-surface-variant mt-0.5">Real-time situational intelligence & squad dispatch telemetry</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon="refresh" onClick={() => window.location.reload()}>Refresh</Button>
          <Button variant="primary" icon="add" onClick={() => navigate(ROUTES.RESPONDER_INCIDENTS)}>New Incident</Button>
        </div>
      </div>

      {/* 5 Core Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard icon="emergency" label="Critical Incidents" value="3" subtitle="Immediate Action" />
        <StatCard icon="priority_high" label="High Priority" value="7" subtitle="Level 2 Escalation" />
        <StatCard icon="warning" label="Active Incidents" value="14" subtitle="Operations Live" />
        <StatCard icon="check_circle" label="Resolved Today" value="89" subtitle="Nominal" />
        <StatCard icon="hub" label="Offline Relays" value="47 / 50" subtitle="Mesh Synchronized" />
      </div>

      {/* Main Grid: AI Recommendations & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: AI Recommendations & Why Reasoning */}
        <div className="lg:col-span-8 space-y-6">
          {/* AI Reasoning Panel */}
          <WhyReasoningPanel />

          {/* Resource Recommendations Grid */}
          <div>
            <h3 className="text-headline-md font-bold text-primary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">alt_route</span>
              AI Resource Allocation Recommendations
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ResourceRecommendationCard
                unitName="Alpha Squad Command"
                role="Search & Structural Rescue"
                sector="Sector 7 — Bridge 9"
                eta="12 min"
                priority="critical"
                reason="Pre-position for anticipated structural failure and immediate perimeter evacuation."
              />
              <ResourceRecommendationCard
                unitName="Medical Unit C"
                role="Field Medical & Triage"
                sector="Field Hospital B — Sector 5"
                eta="18 min"
                priority="critical"
                reason="Supply replenishment for trauma care following earthquake aftershocks."
              />
            </div>
          </div>
        </div>

        {/* Right Column: Recent Activity Feed */}
        <div className="lg:col-span-4 flex flex-col">
          <Timeline items={recentActivity} title="Recent Activity" />
        </div>
      </div>
    </div>
  );
}
