import Button from '../ui/Button';

export default function SignalConfirmationCard({
  icon = 'check_circle',
  title = 'Signal Submitted',
  description,
  details = [],
  primaryActionLabel = 'Return to Dashboard',
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center animate-slide-up">
      <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mb-6">
        <span className="material-symbols-outlined text-success text-5xl" style={{ fontVariationSettings: "'FILL' 1" }}>
          {icon}
        </span>
      </div>

      <h1 className="text-headline-lg font-bold text-primary mb-3">{title}</h1>
      {description && (
        <p className="text-body-lg text-on-surface-variant max-w-md mb-6">{description}</p>
      )}

      {details.length > 0 && (
        <div className="bg-surface-container rounded-xl p-4 max-w-sm w-full mb-8 shadow-xs border border-outline-variant/50">
          <div className="space-y-2.5 text-sm text-left">
            {details.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center gap-2 min-w-0">
                <span className="text-on-surface-variant text-xs shrink-0">{item.label}</span>
                <span className={`font-mono font-bold text-xs truncate ${item.variant === 'success' ? 'text-success' : item.variant === 'secondary' ? 'text-secondary' : 'text-primary'}`}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-3">
        {onPrimaryAction && (
          <Button variant="primary" onClick={onPrimaryAction}>
            {primaryActionLabel}
          </Button>
        )}
        {onSecondaryAction && (
          <Button variant="secondary" onClick={onSecondaryAction}>
            {secondaryActionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
