import { cn } from '../../utils/helpers';

export default function SignalBars({ strength = 0, max = 5, className }) {
  return (
    <div className={cn('flex gap-0.5 items-end', className)}>
      {Array.from({ length: max }).map((_, index) => {
        const barNumber = index + 1;
        const isActive = barNumber <= strength;
        return (
          <div
            key={barNumber}
            className={cn(
              'w-1 rounded-full transition-colors',
              isActive ? 'bg-secondary' : 'bg-outline-variant'
            )}
            style={{ height: `${barNumber * 4 + 4}px` }}
          />
        );
      })}
    </div>
  );
}
