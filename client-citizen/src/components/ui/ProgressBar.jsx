import { cn } from '../../utils/helpers';

export default function ProgressBar({
  value = 0,
  max = 100,
  variant = 'primary',
  showLabel = false,
  className,
}) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const barColors = {
    primary: 'bg-primary',
    secondary: 'bg-secondary',
    success: 'bg-success',
    error: 'bg-error',
  };

  return (
    <div className={cn('w-full', className)}>
      <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500 ease-out', barColors[variant])}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-mono-data text-on-surface-variant mt-1 block text-right">
          {Math.round(percentage)}%
        </span>
      )}
    </div>
  );
}
