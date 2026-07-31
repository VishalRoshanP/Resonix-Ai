import Card from './Card';
import { cn } from '../../utils/helpers';

export default function MapContainerPlaceholder({
  icon = 'map',
  title = 'Interactive Map View',
  subtitle = 'Geospatial intelligence layer with incident markers and responder positions.',
  heightClass = 'h-[380px] sm:h-[460px] md:h-[520px]',
  children,
  className,
}) {
  return (
    <Card className={cn('relative overflow-hidden p-0', heightClass, className)}>
      <div className="absolute inset-0 bg-surface-container-high flex items-center justify-center p-6 text-center">
        <div>
          <span className="material-symbols-outlined text-5xl sm:text-6xl text-outline-variant mb-3 block">
            {icon}
          </span>
          <p className="text-lg sm:text-headline-md font-bold text-primary mb-2">{title}</p>
          {subtitle && (
            <p className="text-xs sm:text-body-md text-on-surface-variant max-w-md mx-auto leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {children}
    </Card>
  );
}
