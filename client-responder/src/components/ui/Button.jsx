import { cn } from '../../utils/helpers';

export default function Button({ children, variant = 'primary', size = 'md', className, icon, loading, ...props }) {
  const variants = {
    primary: 'bg-[#1b1c1d] text-white hover:bg-black dark:bg-secondary dark:hover:bg-secondary/85',
    secondary: 'bg-surface-container text-on-surface hover:bg-surface-container-high border border-outline-variant/60',
    urgent: 'bg-secondary text-white hover:bg-secondary/85 shadow-sm',
    danger: 'bg-error text-white hover:bg-error/90 shadow-sm font-extrabold',
    ghost: 'bg-transparent text-on-surface hover:bg-surface-container-low',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs font-bold rounded-lg min-h-[36px]',
    md: 'px-4 py-2 text-sm font-bold rounded-xl min-h-[44px]',
    lg: 'px-6 py-3 text-base font-extrabold rounded-xl min-h-[48px]',
    full: 'w-full py-3 text-sm font-bold rounded-xl flex justify-center items-center min-h-[44px]',
  };

  return (
    <button
      className={cn('inline-flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 select-none focus:outline-none focus:ring-2 focus:ring-secondary/50', variants[variant] || variants.primary, sizes[size] || sizes.md, className)}
      disabled={loading}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : icon ? (
        <span className="material-symbols-outlined text-lg">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}

