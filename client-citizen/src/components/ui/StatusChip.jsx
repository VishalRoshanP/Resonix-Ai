import { cn } from '../../utils/helpers';

const variantStyles = {
  critical: 'bg-error-container text-on-error-container font-extrabold',
  warning: 'bg-secondary-fixed text-on-secondary-fixed font-extrabold',
  active: 'bg-success/15 text-emerald-900 border border-success/40 font-extrabold',
  resolved: 'bg-surface-container-high text-primary font-bold border border-outline-variant/80',
  offline: 'bg-amber-500/15 text-amber-950 border border-amber-500/30 font-bold',
  info: 'bg-primary-fixed text-on-primary-fixed font-extrabold',
};

export default function StatusChip({ label, variant = 'info', className, dot = false }) {
  const displayLabel = (() => {
    if (!label) return '';
    const s = String(label).toLowerCase();
    if (variant === 'critical' || s === 'critical') {
      return (String(label).includes('🔴') || s.includes('warning')) ? label : `🔴 ${String(label).toUpperCase()} WARNING`;
    }
    if (variant === 'warning' || s === 'warning') {
      return (String(label).includes('🟠') || s.includes('warning') || s.includes('advisory')) ? label : `🟠 ${String(label).toUpperCase()}`;
    }
    return label;
  })();

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-sm text-label-sm uppercase font-black text-[10px] tracking-wider',
        variantStyles[variant],
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            variant === 'critical' && 'bg-error',
            variant === 'warning' && 'bg-secondary',
            variant === 'active' && 'bg-success animate-pulse',
            variant === 'resolved' && 'bg-outline',
            variant === 'offline' && 'bg-outline-variant',
            variant === 'info' && 'bg-primary'
          )}
        />
      )}
      {displayLabel}
    </span>
  );
}
