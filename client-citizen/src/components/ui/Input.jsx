import { cn } from '../../utils/helpers';

export default function Input({
  label,
  icon,
  error,
  className,
  ...props
}) {
  return (
    <div className="space-y-1.5 text-left">
      {label && (
        <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] pointer-events-none select-none">
            {icon}
          </span>
        )}
        <input
          className={cn(
            'w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-2.5',
            'text-sm font-medium text-on-surface placeholder:text-stone-600',
            'focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20',
            'transition-all duration-200 shadow-xs',
            icon && 'pl-10',
            error && 'border-error focus:border-error focus:ring-error/20',
            className
          )}
          {...props}
        />
      </div>
      {error && (
        <p className="text-xs font-semibold text-error flex items-center gap-1 mt-1">
          <span className="material-symbols-outlined text-[14px]">error</span>
          {error}
        </p>
      )}
    </div>
  );
}
