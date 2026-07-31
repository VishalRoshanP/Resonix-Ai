import Card from '../ui/Card';
import StatusChip from '../ui/StatusChip';
import Button from '../ui/Button';

export default function ResourceRecommendationCard({
  unitName = 'Alpha Squad Command',
  role = 'Search & Structural Rescue',
  sector = 'Sector 7 — Bridge 9',
  eta = '12 min',
  priority = 'critical',
  reason = 'Pre-position for anticipated structural failure and immediate perimeter evacuation.',
  onDeploy,
  onReassign,
}) {
  return (
    <Card className="p-5 flex flex-col justify-between hover:border-secondary transition-all">
      <div>
        <div className="flex justify-between items-start mb-3">
          <StatusChip label={`Priority: ${priority}`} variant={priority === 'critical' ? 'critical' : 'warning'} dot />
          <span className="text-mono-data font-bold text-secondary text-xs flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">schedule</span>
            ETA: {eta}
          </span>
        </div>

        <h4 className="text-body-lg font-bold text-primary mb-1">{unitName}</h4>
        <p className="text-xs font-semibold text-on-surface-variant mb-2">{role} • <span className="text-primary">{sector}</span></p>

        <p className="text-xs text-on-surface bg-surface-container/60 p-3 rounded-lg border border-outline-variant/40 mb-4 leading-relaxed">
          {reason}
        </p>
      </div>

      <div className="flex gap-2 pt-2 border-t border-outline-variant/40">
        <Button variant="primary" size="sm" className="flex-1" icon="send" onClick={onDeploy}>
          Approve & Deploy
        </Button>
        {onReassign && (
          <Button variant="secondary" size="sm" icon="alt_route" onClick={onReassign}>
            Reassign
          </Button>
        )}
      </div>
    </Card>
  );
}
