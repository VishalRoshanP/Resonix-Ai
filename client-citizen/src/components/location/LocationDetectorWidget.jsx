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
          <span className="flex items-center gap-1 text-emerald-800 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30" title={`Accuracy: ±${locationData.accuracy}m`}>
            <span className="material-symbols-outlined text-xs">location_on</span>
            GPS (±{locationData.accuracy}m)
          </span>
        )}

        {isUnavailable && (
          <span className="flex items-center gap-1 text-amber-800 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30" title="Location unavailable. Your SOS can still be sent.">
            <span className="material-symbols-outlined text-xs">location_off</span>
            No GPS
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 sm:p-5 text-left space-y-3 shadow-sm animate-fade-in overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-secondary text-xl shrink-0">
            my_location
          </span>
          <span className="font-bold text-primary text-sm">Automatic GPS</span>
        </div>

        <button
          type="button"
          onClick={detectLocation}
          disabled={isDetecting}
          className="text-xs font-semibold text-secondary hover:text-primary transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50 shrink-0 min-h-[32px]"
        >
          <span className={`material-symbols-outlined text-sm ${isDetecting ? 'animate-spin' : ''}`}>
            refresh
          </span>
          {isDetecting ? 'Detecting...' : 'Refresh'}
        </button>
      </div>

      {/* State 1: Detecting */}
      {isDetecting && (
        <div className="p-3 bg-surface-container/40 border border-outline-variant/60 rounded-xl flex items-center gap-3 text-xs text-on-surface-variant font-semibold min-w-0">
          <span className="material-symbols-outlined text-lg animate-spin shrink-0">sync</span>
          <span className="break-words">Acquiring high-accuracy GPS coordinates...</span>
        </div>
      )}

      {/* State 2: GPS Success */}
      {hasLocation && locationData && !isDetecting && (
        <div className="p-3 bg-emerald-50 border border-emerald-300/40 rounded-xl space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-mono font-bold text-emerald-800 flex items-center gap-1 min-w-0">
              <span className="material-symbols-outlined text-sm shrink-0">check_circle</span>
              <span className="truncate">{locationData.latitude.toFixed(5)}°, {locationData.longitude.toFixed(5)}°</span>
            </span>
            <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-emerald-500/15 text-emerald-800 border border-emerald-400/30 whitespace-nowrap shrink-0">
              ±{locationData.accuracy}m
            </span>
          </div>
          <p className="text-[10px] text-on-surface-variant font-medium">
            Coordinates attached automatically for rescue dispatch.
          </p>
        </div>
      )}

      {/* State 3: GPS Unavailable / Failed */}
      {isUnavailable && !isDetecting && (
        <div className="p-3.5 bg-amber-50 border border-amber-300/50 rounded-xl text-xs space-y-2 min-w-0">
          <div className="flex items-start gap-2.5 font-semibold text-amber-900">
            <span className="material-symbols-outlined text-lg shrink-0 mt-0.5">location_off</span>
            <div className="min-w-0">
              <p className="font-bold text-amber-900">Location unavailable. Your SOS can still be sent.</p>
              <p className="text-[10px] text-on-surface-variant font-medium mt-1">
                Emergency reporting is non-blocking. Manual sector pins will be used if needed.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
