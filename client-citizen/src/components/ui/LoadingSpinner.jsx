import { cn } from '../../utils/helpers';

const sizes = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-3',
};

const variants = {
  primary: 'border-primary/20 border-t-primary',
  secondary: 'border-secondary/20 border-t-secondary',
  white: 'border-white/30 border-t-white',
};

export default function LoadingSpinner({ size = 'md', variant = 'primary', className }) {
  return (
    <div
      className={cn(
        'rounded-full animate-spin shrink-0',
        sizes[size] || sizes.md,
        variants[variant] || variants.primary,
        className
      )}
      role="status"
      aria-label="Loading"
    />
  );
}
