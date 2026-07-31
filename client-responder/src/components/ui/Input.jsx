import { cn } from '../../utils/helpers';

export default function Input({ label, icon, className, ...props }) {
  return (
    <div className="space-y-1.5 text-left">
      {label && <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">{label}</label>}
      <div className="relative flex items-center">
        {icon && <span className="material-symbols-outlined absolute left-3 text-on-surface-variant text-lg">{icon}</span>}
        <input
          className={cn(
            'w-full bg-surface-container-lowest border border-outline-variant/80 rounded-xl text-sm text-primary py-2.5 px-3 focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-all',
            icon && 'pl-10',
            className
          )}
          {...props}
        />
      </div>
    </div>
  );
}
