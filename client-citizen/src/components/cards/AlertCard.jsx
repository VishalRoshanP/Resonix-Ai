import Card from '../ui/Card';
import StatusChip from '../ui/StatusChip';
import Button from '../ui/Button';

export default function AlertCard({
  title,
  description,
  severity = 'critical',
  timeLabel,
  onAcknowledge,
  onViewMap,
  onViewData,
}) {
  const variant = severity === 'critical' ? 'emergency' : 'warning';
  const chipVariant = severity === 'critical' ? 'critical' : 'warning';
  const chipLabel = severity === 'critical' ? 'Critical Level 1' : 'Warning Level 2';

  return (
    <Card variant={variant} className="p-5">
      <div className="flex justify-between items-start mb-3">
        <StatusChip label={chipLabel} variant={chipVariant} />
        <span className="text-mono-data text-on-surface-variant text-xs">{timeLabel}</span>
      </div>

      <h4 className="text-headline-md font-bold text-primary mb-2 leading-tight">{title}</h4>
      <p className="text-sm text-on-surface-variant mb-4">{description}</p>

      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
        {severity === 'critical' ? (
          <>
            <Button variant="primary" size="sm" className="flex-1 min-w-[120px]" onClick={onAcknowledge}>
              Acknowledge
            </Button>
            {onViewMap && (
              <Button variant="secondary" size="sm" icon="map" onClick={onViewMap}>
                Map
              </Button>
            )}
          </>
        ) : (
          <Button variant="secondary" size="sm" className="flex-1" onClick={onViewData}>
            View Data
          </Button>
        )}
      </div>
    </Card>
  );
}
