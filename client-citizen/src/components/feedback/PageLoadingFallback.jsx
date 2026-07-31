import LoadingSpinner from '../ui/LoadingSpinner';

export default function PageLoadingFallback() {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center py-16 text-center space-y-4 animate-fade-in">
      <div className="w-16 h-16 bg-surface-container-high rounded-2xl flex items-center justify-center shadow-xs border border-outline-variant/60">
        <LoadingSpinner size="lg" variant="secondary" />
      </div>
      <div>
        <p className="text-body-lg font-bold text-primary">Loading RESONIX AI Module...</p>
        <p className="text-xs font-semibold text-secondary flex items-center justify-center gap-1.5 mt-1">
          <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
          Preparing local Gemma 4 telemetry
        </p>
      </div>
    </div>
  );
}
