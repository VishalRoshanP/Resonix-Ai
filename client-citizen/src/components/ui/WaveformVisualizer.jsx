import { cn } from '../../utils/helpers';

export default function WaveformVisualizer({ active = true, count = 20, className }) {
  if (!active) return null;

  return (
    <div className={cn('flex items-center gap-1 h-12 justify-center', className)}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="w-1 bg-secondary rounded-full"
          style={{
            height: `${Math.random() * 28 + 8}px`,
            animation: `waveform ${0.5 + Math.random() * 0.5}s ease-in-out infinite`,
            animationDelay: `${index * 50}ms`,
          }}
        />
      ))}
    </div>
  );
}
