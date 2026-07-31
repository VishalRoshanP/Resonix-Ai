import { cn } from '../../utils/helpers';

export default function BrandHeader({
  title = 'RESONIX AI',
  subtitle = 'Powered by Gemma 4',
  description,
  centered = false,
  className,
}) {
  return (
    <div className={cn('border-b border-outline-variant pb-4', centered && 'text-center', className)}>
      <h1 className="text-display-lg font-bold text-primary tracking-tight">{title}</h1>
      <p className={cn('text-headline-md font-semibold text-secondary flex items-center gap-2 mt-0.5', centered && 'justify-center')}>
        <span className="w-2 h-2 rounded-full bg-secondary animate-pulse shrink-0" />
        {subtitle}
      </p>
      {description && (
        <p className="text-body-md text-on-surface-variant mt-2 max-w-xl">{description}</p>
      )}
    </div>
  );
}
