// Custom SVG icon components for Resonix AI

export function SignalBars({ strength = 5, className = '' }) {
  return (
    <div className={`flex gap-0.5 items-end ${className}`}>
      {[1, 2, 3, 4, 5].map((bar) => (
        <div
          key={bar}
          className={`w-1 rounded-full transition-colors ${
            bar <= strength ? 'bg-secondary' : 'bg-outline-variant'
          }`}
          style={{ height: `${bar * 4 + 4}px` }}
        />
      ))}
    </div>
  );
}

export function WaveformIcon({ animate = false, className = '' }) {
  return (
    <div className={`flex items-center gap-[2px] ${className}`}>
      {[8, 16, 6, 24, 12, 20, 8, 14].map((h, i) => (
        <div
          key={i}
          className="w-1 bg-current rounded-full"
          style={{
            height: `${h}px`,
            animation: animate ? `waveform ${0.5 + Math.random() * 0.5}s ease-in-out infinite` : 'none',
            animationDelay: animate ? `${i * 60}ms` : '0ms',
          }}
        />
      ))}
    </div>
  );
}

export function PulseRing({ color = 'secondary', className = '' }) {
  return (
    <div className={`absolute inset-0 ${className}`}>
      <div className={`absolute inset-0 border-2 border-${color} rounded-full animate-pulse-ring`} />
    </div>
  );
}
