import { cn } from '../../utils/helpers';

export default function Card({
  children,
  variant = 'default',
  hover = true,
  className,
  ...props
}) {
  return (
    <div
      className={cn(
        'bg-surface-container-lowest border border-outline-variant rounded-lg p-6 transition-all duration-300',
        hover && 'hover:shadow-ambient',
        variant === 'emergency' && 'border-l-4 border-l-error shadow-ambient',
        variant === 'warning' && 'border-l-4 border-l-secondary',
        variant === 'ai' && 'gemma-watermark relative overflow-hidden hover:border-secondary',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
