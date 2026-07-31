import Card from '../components/ui/Card';
import StatusChip from '../components/ui/StatusChip';
import Button from '../components/ui/Button';
import SignalBars from '../components/ui/SignalBars';

export default function MapSignalPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-headline-lg font-bold text-primary">Signal Strength Map</h1>
          <p className="text-body-md text-on-surface-variant mt-1">Unit signal strength & mesh network coverage</p>
        </div>
        <Button variant="secondary" icon="refresh">Refresh Signals</Button>
      </div>

      <Card className="relative h-[380px] sm:h-[460px] md:h-[500px]">
        <div className="absolute inset-0 bg-surface-container-high flex items-center justify-center">
          <div className="text-center">
            <span className="material-symbols-outlined text-6xl text-outline-variant mb-4 block">cell_tower</span>
            <p className="text-headline-md font-bold text-primary mb-2">Signal Coverage Map</p>
            <p className="text-body-md text-on-surface-variant">Real-time signal strength overlay with mesh node visualization.</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { node: 'Node Alpha', signal: 5, status: 'active', hops: 1, location: 'Sector 4' },
          { node: 'Node Bravo', signal: 4, status: 'active', hops: 2, location: 'Sector 7' },
          { node: 'Node Charlie', signal: 2, status: 'degraded', hops: 3, location: 'Sector 2' },
          { node: 'Node Delta', signal: 0, status: 'offline', hops: null, location: 'Sector 9' },
        ].map((n, i) => (
          <Card key={i} className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SignalBars strength={n.signal} />
              <div>
                <p className="text-sm font-bold text-primary">{n.node}</p>
                <p className="text-xs text-on-surface-variant">{n.location} • {n.hops !== null ? `${n.hops} hop${n.hops > 1 ? 's' : ''}` : 'Unreachable'}</p>
              </div>
            </div>
            <StatusChip label={n.status} variant={n.status === 'active' ? 'active' : n.status === 'degraded' ? 'warning' : 'offline'} dot />
          </Card>
        ))}
      </div>
    </div>
  );
}
