import Card from '../components/ui/Card';
import StatusChip from '../components/ui/StatusChip';
import Button from '../components/ui/Button';
import WhyReasoningPanel from '../components/cards/WhyReasoningPanel';
import ResourceRecommendationCard from '../components/cards/ResourceRecommendationCard';

export default function IntelligenceBriefingPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-headline-lg font-bold text-primary">Intelligence Briefing</h1>
          <p className="text-body-md text-on-surface-variant mt-1">AI-generated situational analysis & response planning</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon="download">Export Report</Button>
          <Button variant="primary" icon="auto_awesome">Generate Update</Button>
        </div>
      </div>

      {/* Gemma 4 Executive Summary */}
      <Card variant="ai" className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
          <h3 className="text-headline-md font-bold text-primary">Gemma 4 Executive Summary</h3>
          <StatusChip label="Model v4.0.2 Active" variant="info" className="ml-auto" />
        </div>
        <div className="prose max-w-none text-on-surface space-y-3 leading-relaxed">
          <p className="text-body-md">Current operational status indicates a <strong>Level 2 emergency escalation</strong> centered on Sectors 5 through 8. Primary concern is the compounding effect of seismic activity and flood risk.</p>
          <p className="text-body-md">The mesh relay network is operating at 94% efficiency with 47 of 50 nodes active. Three nodes in Sector 2 and Sector 9 show degraded connectivity, requiring physical inspection within the next 4 hours.</p>
          <p className="text-body-md">Personnel deployment is optimal with 142 active responders. Gemma 4 recommends pre-positioning an additional 8 medical personnel in Sector 7 based on aftershock probability modeling.</p>
        </div>
      </Card>

      {/* Why AI Reasoning Panel */}
      <WhyReasoningPanel />

      {/* Resource Allocation Grid */}
      <div>
        <h3 className="text-headline-md font-bold text-primary mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary">alt_route</span>
          Recommended Resource Allocations
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
          <ResourceRecommendationCard
            unitName="Mobile Relay Tender 4"
            role="Mesh Node Maintenance"
            sector="Sector 2 — Relay Node 14"
            eta="25 min"
            priority="warning"
            reason="Restore degraded signal path before secondary flood crest reaches basin."
          />
        </div>
      </div>
    </div>
  );
}
