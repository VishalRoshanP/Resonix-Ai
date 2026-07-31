import Card from '../ui/Card';

export default function AIStatusCard({
  title = 'Gemma 4: Offline Operational',
  description = 'Local reasoning engine active. Mesh network synced.',
  latency = '12ms (Local)',
  activeNodes = '47 / 50',
  confidence = null,
}) {
  return (
    <Card variant="ai" className="flex flex-col justify-between">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-headline-md font-bold text-primary">{title}</h3>
          <p className="text-on-surface-variant mt-1">{description}</p>
        </div>
        <div className="relative w-12 h-12 flex items-center justify-center">
          <div className="absolute inset-0 border-2 border-secondary rounded-full animate-pulse-ring" />
          <span
            className="material-symbols-outlined text-secondary text-3xl z-10"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            psychology
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 border-t border-outline-variant/60 pt-4 mt-auto">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Latency</p>
          <p className="text-mono-data font-bold text-primary">{latency}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Active Nodes</p>
          <p className="text-mono-data font-bold text-primary">{activeNodes}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Confidence</p>
          <p className="text-mono-data font-bold text-secondary">{confidence || 'Not Available'}</p>
        </div>
      </div>
    </Card>
  );
}
