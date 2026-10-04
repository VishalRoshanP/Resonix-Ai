import Card from '../components/ui/Card';
import ProgressBar from '../components/ui/ProgressBar';
import StatCard from '../components/cards/StatCard';
import StatusChip from '../components/ui/StatusChip';
export default function SystemDiagnosticsPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-headline-lg font-bold text-primary">System Health</h1>
        <StatusChip label="System Health Nominal" variant="active" dot />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon="memory" label="CPU Usage" value="34%" progress={34} progressVariant="primary" />
        <StatCard icon="storage" label="Memory" value="67%" progress={67} progressVariant="secondary" />
        <StatCard icon="hard_drive" label="Disk" value="42%" progress={42} progressVariant="primary" />
        <StatCard icon="network_check" label="Latency" value="12ms" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-body-lg font-bold text-primary mb-4">Emergency Intelligence Engine</h3>
          <div className="space-y-3">
            {[
              { label: 'Version', value: '4.0.2' },
              { label: 'Model Confidence', value: 'Not Available' },
              { label: 'Processing Mode', value: 'Local (Offline)' },
              { label: 'Uptime', value: '72h 14m' },
              { label: 'Last Sync', value: '2 min ago' },
              { label: 'Active Threads', value: '8 / 12' },
            ].map((item, i) => (
              <div key={i} className="flex justify-between text-sm border-b border-outline-variant/50 pb-2 last:border-0">
                <span className="text-on-surface-variant">{item.label}</span>
                <span className="font-mono font-semibold text-primary">{item.value}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h3 className="text-body-lg font-bold text-primary mb-4">Mesh Network Status</h3>
          <div className="space-y-3">
            {[
              { label: 'Active Nodes', value: '47 / 50' },
              { label: 'Degraded Nodes', value: '2' },
              { label: 'Offline Nodes', value: '1' },
              { label: 'Avg. Hop Count', value: '2.1' },
              { label: 'Total Bandwidth', value: '4.2 Gbps' },
              { label: 'Packet Loss', value: '0.02%' },
            ].map((item, i) => (
              <div key={i} className="flex justify-between text-sm border-b border-outline-variant/50 pb-2 last:border-0">
                <span className="text-on-surface-variant">{item.label}</span>
                <span className="font-mono font-semibold text-primary">{item.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
