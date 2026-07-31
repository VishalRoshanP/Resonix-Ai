import Card from '../components/ui/Card';
import StatusChip from '../components/ui/StatusChip';
export default function LogisticsAlertsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-headline-lg font-bold text-primary">Logistics Alert Pulses</h1>
      <p className="text-body-md text-on-surface-variant">Real-time supply chain disruptions & alerts</p>
      <div className="space-y-4">
        {[
          { title: 'Medical Supply Shortage — Sector 7', severity: 'critical', detail: 'IV fluid stock below 20%. Replenishment requested.', time: '5m ago' },
          { title: 'Transport Delay — Route Alpha', severity: 'warning', detail: 'Road obstruction detected. ETA extended by 22 minutes.', time: '12m ago' },
          { title: 'Fuel Reserve Low — Base Camp', severity: 'warning', detail: 'Generator fuel at 15%. Emergency resupply en route.', time: '28m ago' },
          { title: 'Equipment Delivered — Sector 4', severity: 'active', detail: 'Communication relay equipment installed successfully.', time: '1h ago' },
        ].map((alert, i) => (
          <Card key={i} variant={alert.severity === 'critical' ? 'emergency' : alert.severity === 'warning' ? 'warning' : 'default'} className="p-5">
            <div className="flex justify-between items-start mb-2"><StatusChip label={alert.severity} variant={alert.severity} /><span className="text-mono-data text-on-surface-variant">{alert.time}</span></div>
            <h3 className="text-body-lg font-bold text-primary mb-1">{alert.title}</h3>
            <p className="text-sm text-on-surface-variant">{alert.detail}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
