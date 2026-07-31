import Card from '../components/ui/Card';
import StatCard from '../components/cards/StatCard';
import StatusChip from '../components/ui/StatusChip';
export default function AnalyticsDashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-headline-lg font-bold text-primary">Analytics Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="speed" label="Avg Response" value="4.2m" sparkline progress={78} progressVariant="secondary" />
        <StatCard icon="check_circle" label="Resolved" value="23" subtitle="last 24h" />
        <StatCard icon="warning" label="Active" value="4" />
        <StatCard icon="trending_up" label="Efficiency" value="94%" progress={94} progressVariant="success" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-body-lg font-bold text-primary mb-4">Incident Trend (24h)</h3>
          <div className="h-48 flex items-end gap-2 px-4">
            {[3, 5, 2, 7, 4, 8, 3, 6, 4, 2, 5, 3].map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-secondary/20 rounded-t-sm relative" style={{ height: `${v * 20}px` }}>
                  <div className="absolute bottom-0 left-0 right-0 bg-secondary rounded-t-sm transition-all" style={{ height: `${v * 14}px` }} />
                </div>
                <span className="text-[10px] text-on-surface-variant">{`${i * 2}h`}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h3 className="text-body-lg font-bold text-primary mb-4">Response Distribution</h3>
          <div className="space-y-3">
            {[
              { label: 'Seismic', count: 8, pct: 35, color: 'bg-error' },
              { label: 'Flood', count: 6, pct: 26, color: 'bg-secondary' },
              { label: 'Infrastructure', count: 5, pct: 22, color: 'bg-primary' },
              { label: 'Medical', count: 4, pct: 17, color: 'bg-success' },
            ].map((item, i) => (
              <div key={i}>
                <div className="flex justify-between text-sm mb-1"><span className="text-on-surface">{item.label}</span><span className="text-mono-data text-on-surface-variant">{item.count} ({item.pct}%)</span></div>
                <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden"><div className={`${item.color} h-full rounded-full`} style={{ width: `${item.pct}%` }} /></div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
