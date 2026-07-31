import Card from '../components/ui/Card';
import StatCard from '../components/cards/StatCard';
import StatusChip from '../components/ui/StatusChip';
import Button from '../components/ui/Button';

export default function PredictiveDashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-headline-lg font-bold text-primary">Predictive Intelligence</h1>
          <p className="text-body-md text-on-surface-variant mt-1">AI-powered forecasting & risk assessment</p>
        </div>
        <StatusChip label="Gemma 4 Active" variant="active" dot />
      </div>

      {/* Prediction Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card variant="ai" className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-secondary">earthquake</span>
            <h3 className="text-body-lg font-bold text-primary">Seismic Forecast</h3>
          </div>
          <div className="text-3xl font-bold font-mono text-primary mb-2">72%</div>
          <p className="text-sm text-on-surface-variant mb-4">Probability of aftershock within 6 hours in Sector 5-8 corridor.</p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-on-surface-variant">Magnitude Range</span><span className="font-mono font-semibold text-primary">3.2 - 4.8</span></div>
            <div className="flex justify-between text-sm"><span className="text-on-surface-variant">Confidence</span><span className="font-mono font-semibold text-secondary">Not Available</span></div>
            <div className="flex justify-between text-sm"><span className="text-on-surface-variant">Data Points</span><span className="font-mono font-semibold text-primary">12,847</span></div>
          </div>
        </Card>

        <Card variant="ai" className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-secondary">flood</span>
            <h3 className="text-body-lg font-bold text-primary">Flood Risk Model</h3>
          </div>
          <div className="text-3xl font-bold font-mono text-error mb-2">HIGH</div>
          <p className="text-sm text-on-surface-variant mb-4">River basin levels projected to exceed threshold by 14:00 UTC.</p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-on-surface-variant">Current Level</span><span className="font-mono font-semibold text-primary">4.2m / 5.0m</span></div>
            <div className="flex justify-between text-sm"><span className="text-on-surface-variant">Rise Rate</span><span className="font-mono font-semibold text-error">+0.3m/hr</span></div>
            <div className="flex justify-between text-sm"><span className="text-on-surface-variant">Evac Time</span><span className="font-mono font-semibold text-secondary">~45 min</span></div>
          </div>
        </Card>

        <Card variant="ai" className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-secondary">inventory_2</span>
            <h3 className="text-body-lg font-bold text-primary">Supply Demand</h3>
          </div>
          <div className="text-3xl font-bold font-mono text-primary mb-2">+340</div>
          <p className="text-sm text-on-surface-variant mb-4">Additional medical kits needed within next 24 hours.</p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-on-surface-variant">Water</span><span className="font-mono font-semibold text-primary">2,400L</span></div>
            <div className="flex justify-between text-sm"><span className="text-on-surface-variant">Medical</span><span className="font-mono font-semibold text-secondary">340 kits</span></div>
            <div className="flex justify-between text-sm"><span className="text-on-surface-variant">Fuel</span><span className="font-mono font-semibold text-primary">1,200L</span></div>
          </div>
        </Card>
      </div>

      {/* AI Timeline */}
      <Card>
        <h3 className="text-headline-md font-bold text-primary mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary">timeline</span>
          Predictive Timeline
        </h3>
        <div className="space-y-4">
          {[
            { time: '+30m', event: 'River basin breach predicted', severity: 'critical', action: 'Auto-dispatch evacuation units' },
            { time: '+2h', event: 'Aftershock probability peak', severity: 'warning', action: 'Pre-position medical teams' },
            { time: '+6h', event: 'Power grid restoration window', severity: 'active', action: 'Schedule maintenance crews' },
            { time: '+12h', event: 'Supply chain replenishment', severity: 'info', action: 'Coordinate logistics drop' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-4 p-3 bg-surface-container-low rounded-DEFAULT">
              <span className="text-mono-data font-bold text-secondary w-12 shrink-0">{item.time}</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-primary">{item.event}</p>
                <p className="text-xs text-on-surface-variant">{item.action}</p>
              </div>
              <StatusChip label={item.severity} variant={item.severity} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
