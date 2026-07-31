import Card from '../components/ui/Card';
import StatusChip from '../components/ui/StatusChip';
import Button from '../components/ui/Button';
import SignalBars from '../components/ui/SignalBars';

export default function OfflineRelayPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-headline-lg font-bold text-primary">Offline Relay Network</h1>
        <StatusChip label="Mesh Active" variant="active" dot />
      </div>
      <Card variant="ai" className="p-6 text-center">
        <span className="material-symbols-outlined text-secondary text-5xl mb-4 block" style={{ fontVariationSettings: "'FILL' 1" }}>hub</span>
        <h2 className="text-headline-md font-bold text-primary mb-2">Mesh Network Operational</h2>
        <p className="text-body-md text-on-surface-variant max-w-md mx-auto mb-6">
          Internet connection unavailable. All communications are routed through the peer-to-peer mesh relay network.
        </p>
        <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
          <div><p className="text-label-sm uppercase text-on-surface-variant">Nodes</p><p className="text-xl font-bold font-mono text-primary">47/50</p></div>
          <div><p className="text-label-sm uppercase text-on-surface-variant">Pending</p><p className="text-xl font-bold font-mono text-secondary">3</p></div>
          <div><p className="text-label-sm uppercase text-on-surface-variant">Delivered</p><p className="text-xl font-bold font-mono text-success">284</p></div>
        </div>
      </Card>
      <div className="space-y-3">
        {[
          { from: 'Node Alpha', message: 'Evacuation route confirmed clear.', time: '2m ago', signal: 5 },
          { from: 'Node Bravo', message: 'Medical supplies dispatched.', time: '8m ago', signal: 4 },
          { from: 'Node Charlie', message: 'Signal degraded. Retrying broadcast.', time: '15m ago', signal: 2 },
        ].map((msg, i) => (
          <Card key={i} className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SignalBars strength={msg.signal} />
              <div><p className="text-sm font-bold text-primary">{msg.from}</p><p className="text-xs text-on-surface-variant">{msg.message}</p></div>
            </div>
            <span className="text-mono-data text-on-surface-variant shrink-0">{msg.time}</span>
          </Card>
        ))}
      </div>
      <Button variant="primary" size="full" icon="send">Compose Relay Message</Button>
    </div>
  );
}
