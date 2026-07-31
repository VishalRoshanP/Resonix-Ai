import { cn } from '../../utils/helpers';
import LoadingSpinner from './LoadingSpinner';

const variants = {
  primary: 'bg-primary text-on-primary font-bold border-b-[2px] border-tertiary hover:bg-tertiary active:translate-y-[1px] active:border-b-0',
  urgent: 'bg-secondary text-on-secondary font-bold border-b-[2px] border-secondary-container hover:brightness-90 active:translate-y-[1px] active:border-b-0',
  secondary: 'bg-surface-container-lowest border border-outline-variant text-primary font-bold hover:bg-surface-variant',
  ghost: 'text-on-surface-variant hover:bg-surface-container-high hover:text-primary',
  icon: 'p-2 rounded-full hover:bg-surface-container-low text-on-surface-variant',
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
  full: 'w-full px-4 py-3',
};

const iconSizes = {
  sm: 'text-[16px]',
  md: 'text-[18px]',
  lg: 'text-[22px]',
  full: 'text-[18px]',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  className,
  disabled,
  ...props
}) {
  const iconSizeClass = iconSizes[size] || 'text-[18px]';
  const isDisableOrLoading = disabled || loading;

  const spinnerVariant = variant === 'primary' || variant === 'urgent' ? 'white' : 'primary';

  return (
    <button
      disabled={isDisableOrLoading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-DEFAULT transition-all duration-200 cursor-pointer select-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-1',
        isDisableOrLoading && 'opacity-75 cursor-not-allowed pointer-events-none',
        variants[variant],
        variant !== 'icon' && sizes[size],
        className
      )}
      {...props}
    >
      {loading ? (
        <LoadingSpinner size="sm" variant={spinnerVariant} />
      ) : (
        icon && iconPosition === 'left' && (
          <span className={cn('material-symbols-outlined shrink-0', iconSizeClass)}>{icon}</span>
        )
      )}
      {children}
      {!loading && icon && iconPosition === 'right' && (
        <span className={cn('material-symbols-outlined shrink-0', iconSizeClass)}>{icon}</span>
      )}
    </button>
  );
}
