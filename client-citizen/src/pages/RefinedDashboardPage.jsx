import Card from '../components/ui/Card';
import StatusChip from '../components/ui/StatusChip';
import Button from '../components/ui/Button';
import StatCard from '../components/cards/StatCard';
import Timeline from '../components/data/Timeline';

export default function RefinedDashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-headline-lg font-bold text-primary">Operations Center</h1>
          <p className="text-body-md text-on-surface-variant mt-1">Enhanced telemetry & real-time monitoring</p>
        </div>
        <Button variant="urgent" icon="emergency">Escalate</Button>
      </div>

      {/* Telemetry Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="speed" label="Response Time" value="4.2m" subtitle="avg across sectors" progress={78} progressVariant="secondary" />
        <StatCard icon="sensors" label="Active Sensors" value="342" subtitle="98% coverage" progress={98} progressVariant="primary" />
        <StatCard icon="cell_tower" label="Relay Uptime" value="99.7%" sparkline progress={99} progressVariant="success" />
        <StatCard icon="thermostat" label="Ambient Temp" value="28°C" subtitle="Sector 7 elevated" />
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Incident Feed */}
          <Card>
            <h3 className="text-headline-md font-bold text-primary mb-4">Active Incident Feed</h3>
            <div className="space-y-3">
              {[
                { title: 'Bridge 9 Structural Alert', severity: 'critical', sector: 'S7', time: '2m ago' },
                { title: 'Water Treatment Offline', severity: 'warning', sector: 'S4', time: '8m ago' },
                { title: 'Evacuation Route Clear', severity: 'active', sector: 'S2', time: '12m ago' },
                { title: 'Power Restored: Grid Node 14', severity: 'resolved', sector: 'S14', time: '1h ago' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-outline-variant/50 last:border-0">
                  <div className="flex items-center gap-3">
                    <StatusChip label={item.severity} variant={item.severity} dot />
                    <div>
                      <p className="text-sm font-semibold text-primary">{item.title}</p>
                      <p className="text-xs text-on-surface-variant">{item.sector}</p>
                    </div>
                  </div>
                  <span className="text-mono-data text-on-surface-variant">{item.time}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Resource Allocation */}
          <Card>
            <h3 className="text-body-lg font-bold text-primary mb-4">Resource Allocation</h3>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Medical Units', deployed: 12, total: 15 },
                { label: 'Transport', deployed: 8, total: 10 },
                { label: 'Communication', deployed: 45, total: 50 },
              ].map((r, i) => (
                <div key={i} className="text-center">
                  <p className="text-2xl font-bold font-mono text-primary">{r.deployed}<span className="text-sm text-on-surface-variant">/{r.total}</span></p>
                  <p className="text-label-sm text-on-surface-variant uppercase mt-1">{r.label}</p>
                  <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden mt-2">
                    <div className="bg-secondary h-full rounded-full" style={{ width: `${(r.deployed / r.total) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* AI Recommendations */}
        <Card variant="ai">
          <h3 className="text-body-lg font-bold text-primary mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
            Gemma 4 Recommendations
          </h3>
          <div className="space-y-4">
            {[
              { priority: 'high', text: 'Deploy additional medical units to Sector 7 within 15 minutes.' },
              { priority: 'medium', text: 'Reroute evacuation traffic via Route B—Route A capacity at 87%.' },
              { priority: 'low', text: 'Schedule relay node maintenance for Node Charlie (degraded signal).' },
            ].map((rec, i) => (
              <div key={i} className="p-3 bg-surface-container rounded-DEFAULT border-l-2 border-secondary">
                <div className="flex items-center gap-2 mb-1">
                  <StatusChip label={rec.priority} variant={rec.priority === 'high' ? 'critical' : rec.priority === 'medium' ? 'warning' : 'info'} />
                </div>
                <p className="text-sm text-on-surface">{rec.text}</p>
              </div>
            ))}
            <Button variant="secondary" size="full" icon="psychology">
              Generate Full Briefing
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
