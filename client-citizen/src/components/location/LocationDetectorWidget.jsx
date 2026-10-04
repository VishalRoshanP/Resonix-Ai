import { useLocationDetector } from '../../hooks/useLocationDetector';

export default function LocationDetectorWidget({ compact = false }) {
  const {
    locationData,
    hasLocation,
    isDetecting,
    isUnavailable,
    errorMessage,
    detectLocation,
  } = useLocationDetector();

  if (compact) {
    return (
      <div className="inline-flex items-center gap-1.5 text-xs font-semibold">
        {isDetecting && (
          <span className="flex items-center gap-1 text-secondary">
            <span className="material-symbols-outlined text-xs animate-spin">sync</span>
            Locating...
          </span>
        )}

        {hasLocation && locationData && (
          <span className="flex items-center gap-1 text-emerald-800 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30" title={`Accuracy: ±${locationData.accuracy}m`}>
            <span className="material-symbols-outlined text-xs">location_on</span>
            GPS (±{locationData.accuracy}m)
          </span>
        )}

        {isUnavailable && (
          <span className="flex items-center gap-1 text-amber-800 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30" title="Location unavailable. Your SOS can still be sent.">
            <span className="material-symbols-outlined text-xs">location_off</span>
            No GPS
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="bg-surface-container border border-outline-variant/60 rounded-xl p-3 sm:p-3.5 text-left shadow-xs transition-all animate-fade-in">
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <span className={`material-symbols-outlined text-xl shrink-0 ${
            isDetecting
              ? 'text-secondary animate-spin'
              : hasLocation && locationData
              ? 'text-emerald-600 dark:text-emerald-400 animate-gps-check'
              : 'text-amber-600 dark:text-amber-400'
          }`}>
            {isDetecting ? 'sync' : hasLocation && locationData ? 'check_circle' : 'location_off'}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-bold text-xs leading-tight ${
                hasLocation && locationData
                  ? 'text-emerald-800 dark:text-emerald-300'
                  : isDetecting
                  ? 'text-secondary'
                  : 'text-amber-800 dark:text-amber-300'
              }`}>
                {isDetecting
                  ? 'Acquiring GPS coordinates...'
                  : hasLocation && locationData
                  ? '✓ Location Ready'
                  : 'Location unavailable'}
              </span>
              {hasLocation && locationData && !isDetecting && (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 shrink-0">
                  ±{locationData.accuracy}m
                </span>
              )}
            </div>

            <p className="text-[11px] text-on-surface-variant font-mono truncate mt-0.5">
              {isDetecting
                ? 'Contacting emergency satellites...'
                : hasLocation && locationData
                ? `${locationData.latitude.toFixed(4)}°, ${locationData.longitude.toFixed(4)}° • Accuracy ±${locationData.accuracy}m`
                : 'Emergency SOS will send last known coordinates.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={detectLocation}
          disabled={isDetecting}
          className="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container-high rounded-lg transition-colors flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-50 min-h-[36px] min-w-[36px]"
          title="Refresh GPS Location"
          aria-label="Refresh GPS Location"
        >
          <span className={`material-symbols-outlined text-base ${isDetecting ? 'animate-spin text-secondary' : ''}`}>
            refresh
          </span>
        </button>
      </div>
    </div>
  );
}
