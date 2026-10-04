import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { weatherApi } from '../../services/api';
import useSocket from '../../hooks/useSocket';

export default function LiveWeatherBar({ className = '', defaultLat = 12.9716, defaultLon = 77.5946 }) {
  const [weatherData, setWeatherData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorNotice, setErrorNotice] = useState(null);
  const [showWarningDetails, setShowWarningDetails] = useState(false);
  const { lastSocketEvent } = useSocket();

  const fetchWeather = useCallback(async (isBypass = false) => {
    try {
      if (isBypass) setIsRefreshing(true);
      setErrorNotice(null);

      const res = await weatherApi.getComprehensive(defaultLat, defaultLon, { fresh: isBypass });
      const data = res?.data || res;
      if (data && data.current) {
        setWeatherData(data);
      }
    } catch (err) {
      console.warn('[LiveWeatherBar] Weather telemetry query notice:', err.message);
      setErrorNotice(err.message || 'Meteorological stream offline');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [defaultLat, defaultLon]);

  useEffect(() => {
    fetchWeather(false);
  }, [fetchWeather]);

  // Reactive updates on incoming Socket.IO events from backend worker
  useEffect(() => {
    if (!lastSocketEvent) return;

    if (lastSocketEvent.type === 'WEATHER_UPDATED') {
      setWeatherData((prev) => {
        if (!prev) return lastSocketEvent;
        return {
          ...prev,
          current: lastSocketEvent.current || prev.current,
          metadata: lastSocketEvent.metadata || prev.metadata,
          warnings: lastSocketEvent.warnings || prev.warnings,
          timestamp: lastSocketEvent.timestamp || prev.timestamp,
        };
      });
      setErrorNotice(null);
    } else if (lastSocketEvent.type === 'WEATHER_WARNING') {
      setWeatherData((prev) => {
        if (!prev) return prev;
        const currentWarnings = prev.warnings || [];
        const exists = currentWarnings.some((w) => w.id === lastSocketEvent.warning?.id);
        if (exists) return prev;
        return {
          ...prev,
          warnings: [lastSocketEvent.warning, ...currentWarnings],
        };
      });
    } else if (lastSocketEvent.type === 'FORECAST_UPDATED') {
      setWeatherData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          current: lastSocketEvent.current || prev.current,
          timestamp: lastSocketEvent.timestamp || prev.timestamp,
        };
      });
    } else if (lastSocketEvent.type === 'SOCKET_RECONNECTED') {
      // After socket reconnection, fetch latest weather state from backend
      console.log('[LiveWeatherBar] 🔄 Socket reconnected. Fetching latest weather state...');
      fetchWeather(false);
    }
  }, [lastSocketEvent, fetchWeather]);


  // Local dynamic freshness calculator
  const [freshnessDisplay, setFreshnessDisplay] = useState('Updated just now');
  useEffect(() => {
    const updateFreshness = () => {
      const isCached = Boolean(weatherData?.metadata?.isCached);
      const prefix = isCached ? 'Cached' : 'Updated';
      if (!weatherData?.metadata?.cachedAt && !weatherData?.metadata?.sourceUpdateTime && !weatherData?.timestamp) return;
      const refTime = new Date(weatherData.metadata?.cachedAt || weatherData.metadata?.sourceUpdateTime || weatherData.timestamp).getTime();
      const diffMs = Math.max(0, Date.now() - refTime);
      const minutes = Math.floor(diffMs / 60000);

      if (minutes < 1) {
        setFreshnessDisplay(`${prefix} just now`);
      } else if (minutes === 1) {
        setFreshnessDisplay(`${prefix} 1 minute ago`);
      } else if (minutes < 60) {
        setFreshnessDisplay(`${prefix} ${minutes} minutes ago`);
      } else {
        const hours = Math.floor(minutes / 60);
        setFreshnessDisplay(`${prefix} ${hours} hour${hours > 1 ? 's' : ''} ago`);
      }
    };

    updateFreshness();
    const interval = setInterval(updateFreshness, 30000);
    return () => clearInterval(interval);
  }, [weatherData]);

  if (isLoading) {
    return (
      <div className={`p-3 rounded-xl bg-surface-container/60 border border-outline-variant/60 animate-pulse flex items-center justify-between text-xs ${className}`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-surface-container-high"></div>
          <div className="h-4 w-48 bg-surface-container-high rounded"></div>
        </div>
        <div className="h-4 w-28 bg-surface-container-high rounded"></div>
      </div>
    );
  }

  if (!weatherData && errorNotice) {
    return (
      <div className={`p-2.5 rounded-xl bg-surface-container border border-outline-variant/60 text-xs text-on-surface-variant flex items-center justify-between gap-3 ${className}`}>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-amber-500 text-sm">cloud_off</span>
          <span>Meteorological stream unavailable</span>
        </div>
        <button
          onClick={() => fetchWeather(true)}
          className="text-primary hover:text-secondary font-bold flex items-center gap-1 cursor-pointer"
          id="btn-retry-responder-weather"
        >
          <span className="material-symbols-outlined text-xs">refresh</span> Ingest Now
        </button>
      </div>
    );
  }

  const current = weatherData?.current || {};
  const metadata = weatherData?.metadata || {};
  const warnings = weatherData?.warnings || [];
  const locationName = weatherData?.location?.name || 'Operations Hub';

  // Strict freshness check: Never claim live if stale or provider offline
  const isStale = Boolean(metadata.isStale || metadata.ageMinutes >= 30);
  const isCached = Boolean(metadata.isCached);
  const statusBadge = isStale ? 'STALE' : isCached ? 'CACHED' : 'LIVE';

  return (
    <div
      id="responder-live-weather-bar"
      className={`rounded-xl border transition-all duration-200 overflow-hidden shadow-xs ${
        isStale
          ? 'bg-amber-500/10 border-amber-500/30'
          : warnings.length > 0
          ? 'bg-surface-container border-error/40'
          : 'bg-surface-container border-outline-variant/60'
      } ${className}`}
    >
      {/* Active Disaster Warning Banner */}
      {warnings.length > 0 && (
        <div className="bg-error/15 border-b border-error/30 px-3.5 py-1.5 flex items-center justify-between gap-2 text-error text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-base animate-pulse shrink-0">emergency_home</span>
            <span className="font-extrabold uppercase tracking-wider text-[11px] truncate">
              {warnings[0].headline || warnings[0].event || 'Severe Weather Hazard Alert'}
            </span>
            <span className="hidden md:inline text-[11px] opacity-90 truncate">
              — {warnings[0].safetyRecommendation || warnings[0].description}
            </span>
          </div>
          <button
            onClick={() => setShowWarningDetails((prev) => !prev)}
            className="text-[10px] font-mono font-bold uppercase underline shrink-0 hover:text-white"
          >
            {showWarningDetails ? 'Hide' : 'Details'}
          </button>
        </div>
      )}

      {/* Expanded Warning Details */}
      {showWarningDetails && warnings.length > 0 && (
        <div className="p-3 bg-error/10 border-b border-error/20 text-xs text-on-surface space-y-1 animate-fade-in font-mono">
          <div className="font-bold text-error flex items-center gap-2">
            <span>SEVERITY: {warnings[0].severity || 'CRITICAL'}</span>
            <span>•</span>
            <span>EVENT: {warnings[0].event || 'Atmospheric Event'}</span>
          </div>
          <p className="text-[11px] text-on-surface-variant font-sans">
            {warnings[0].description}
          </p>
          {warnings[0].safetyRecommendation && (
            <p className="text-[11px] text-error font-sans font-bold">
              Recommendation: {warnings[0].safetyRecommendation}
            </p>
          )}
        </div>
      )}

      {/* Main Tactical Bar */}
      <div className="p-2.5 sm:px-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left: Hub, Condition & Temperature */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-secondary/15 border border-secondary/30 flex items-center justify-center shrink-0 text-secondary">
            <span className="material-symbols-outlined text-lg">
              {current.icon || 'wb_sunny'}
            </span>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-primary font-mono text-sm tracking-tight whitespace-nowrap">
                {current.temperature != null && !isNaN(Number(current.temperature))
                  ? `${Number(current.temperature).toFixed(1)}°C`
                  : '—'}
              </span>
              <span className="font-bold text-on-surface-variant text-[11px]">
                {current.conditionDescription || 'Atmospheric Feed'}
              </span>
              <span className="text-[10px] text-on-surface-variant/80 hidden sm:inline">
                ({locationName})
              </span>
            </div>
          </div>
        </div>

        {/* Center: Tactical Telemetry Matrix */}
        <div className="flex items-center gap-4 text-[11px] font-mono text-on-surface-variant">
          <div className="hidden lg:flex items-center gap-1" title="Wind Velocity">
            <span className="material-symbols-outlined text-xs text-on-surface-variant/70">air</span>
            <span className="font-bold text-primary">
              {current.windSpeed != null && !isNaN(Number(current.windSpeed)) ? `${current.windSpeed} km/h` : '—'}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-1" title="Relative Humidity">
            <span className="material-symbols-outlined text-xs text-on-surface-variant/70">humidity_percentage</span>
            <span className="font-bold text-primary">
              {current.humidity != null && !isNaN(Number(current.humidity)) ? `${current.humidity}%` : '—'}
            </span>
          </div>

          <div className="flex items-center gap-1" title="Precipitation">
            <span className="material-symbols-outlined text-xs text-on-surface-variant/70">rainy</span>
            <span className="font-bold text-primary">
              {current.precipitation != null && !isNaN(Number(current.precipitation)) ? `${current.precipitation} mm` : '—'}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1" title="Precipitation Probability">
            <span className="text-[10px] text-on-surface-variant/70">PROB:</span>
            <span className="font-bold text-primary">
              {current.precipitationProbability != null && !isNaN(Number(current.precipitationProbability))
                ? `${current.precipitationProbability}%`
                : '—'}
            </span>
          </div>
        </div>

        {/* Right: Freshness Age Badge & Controls */}
        <div className="flex items-center gap-2.5 shrink-0 font-mono text-[10px]">
          {/* Status Badge */}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-extrabold uppercase ${
              isStale
                ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40'
                : isCached
                ? 'bg-sky-500/20 text-sky-800 dark:text-sky-300 border border-sky-500/40'
                : 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/40'
            }`}
            title={isStale ? 'Provider offline or data stale. Displaying last valid meteorological snapshot.' : isCached ? 'Cached meteorological snapshot.' : 'Live meteorological stream active'}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isStale ? 'bg-amber-500' : isCached ? 'bg-sky-500' : 'bg-emerald-500 animate-pulse'}`} />
            {statusBadge}
          </span>

          {/* Age Label with Data Timestamp */}
          <span className="text-on-surface-variant font-medium" title={metadata.sourceUpdateTime ? `Data observed: ${new Date(metadata.sourceUpdateTime).toLocaleString()}` : freshnessDisplay}>
            {freshnessDisplay}
            {metadata.sourceUpdateTime && (
              <span className="ml-1 opacity-70">
                (Data: {new Date(metadata.sourceUpdateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })})
              </span>
            )}
          </span>

          {/* Manual Trigger */}
          <button
            id="btn-refresh-responder-weather"
            onClick={() => fetchWeather(true)}
            disabled={isRefreshing}
            className="p-1 rounded hover:bg-surface-container-highest text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
            title="Trigger meteorological ingestion refresh"
            aria-label="Refresh weather data"
          >
            <span className={`material-symbols-outlined text-sm ${isRefreshing ? 'animate-spin text-secondary' : ''}`}>
              refresh
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
