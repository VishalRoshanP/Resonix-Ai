import Card from '../ui/Card';
import ProgressBar from '../ui/ProgressBar';
import { cn } from '../../utils/helpers';

export default function StatCard({
  icon,
  label,
  value,
  subtitle,
  progress,
  progressVariant = 'primary',
  sparkline = false,
  className,
}) {
  return (
    <Card className={cn('p-4 flex flex-col justify-between', className)}>
      <div>
        <div className="flex items-center gap-2 mb-1.5 text-on-surface-variant">
          {icon && <span className="material-symbols-outlined text-[18px] text-secondary">{icon}</span>}
          <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant truncate">{label}</span>
        </div>

        <div className="text-xl sm:text-2xl font-bold font-mono text-primary flex items-center tracking-tight">
          {subtitle === 'pulse' && (
            <span className="inline-block w-2.5 h-2.5 bg-success rounded-full mr-2 shrink-0 animate-pulse shadow-[0_0_8px_#4CAF50]" />
          )}
          <span className="truncate">{value}</span>
        </div>
      </div>

      <div>
        {sparkline && (
          <div className="h-7 w-full mt-2 opacity-70">
            <svg viewBox="0 0 200 40" className="w-full h-full overflow-visible">
              <path
                d="M0 25 Q 25 8, 50 20 T 100 15 T 150 25 T 200 18"
                fill="none"
                stroke="#C66A1A"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        )}

        {subtitle && subtitle !== 'pulse' && (
          <div className="text-xs font-medium text-on-surface-variant mt-1.5 truncate">{subtitle}</div>
        )}

        {progress !== undefined && (
          <ProgressBar value={progress} variant={progressVariant} className="mt-2.5" />
        )}
      </div>
    </Card>
  );
}
