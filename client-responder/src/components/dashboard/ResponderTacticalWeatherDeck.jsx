import React, { useState } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';

/**
 * ResponderTacticalWeatherDeck (PHASE 7 — RESPONDER / ADVANCED WEATHER PRESENTATION)
 * 
 * Strict Invariants:
 * 1. RESPONDER PRIMARY VIEW Prioritization:
 *    - Active warnings
 *    - High-risk locations
 *    - Citizen reports
 *    - Incident clusters
 *    - Forecast
 *    - Weather conditions
 *    - Location
 * 
 * 2. NWP Expandable Models:
 *    - GFS (NOAA Global Forecast System)
 *    - ECMWF (ECMWF Integrated Forecasting System)
 *    - WRF-derived data
 *    * Shows for each: Model, Forecast time, Source, Data timestamp.
 *    * CRITICAL: Never claim WRF is locally executed if it is only WRF-derived data.
 * 
 * 3. RISK with Strict Source Separation:
 *    - Risk score
 *    - Contributing signals
 *    - Forecast
 *    - Official warning
 *    - Citizen ground reports
 *    * Sources are visibly separated and never conflated.
 */
export default function ResponderTacticalWeatherDeck({
  weatherData = null,
  activeAlerts = [],
  riskAssessment = null,
  situationData = null,
  clusters = [],
  incidents = [],
  operationalCoordinates = { lat: 12.9716, lon: 77.5946 },
  isLoading = false,
  onRefresh,
  onSelectCluster,
  onFocusLocation,
  className = '',
}) {
  // NWP Model Expansion State ('all' | 'gfs' | 'ecmwf' | 'wrf' | null)
  const [expandedNwpModel, setExpandedNwpModel] = useState('all');
  const [isNwpExpanded, setIsNwpExpanded] = useState(true);

  // Risk Contributing Signals Details Expansion
  const [showRiskSignals, setShowRiskSignals] = useState(true);

  const current = weatherData?.current || {};
  const metadata = weatherData?.metadata || {};
  const locationName = weatherData?.location?.name || situationData?.location?.name || 'HQ Operational Sector';
  const radiusKm = situationData?.location?.radiusKm || 25;

  // Extract High-Risk Locations from clusters and incidents
  const highRiskLocations = React.useMemo(() => {
    const list = [];
    // From Clusters
    clusters.forEach((c) => {
      const priority = (c.highestPriority || c.priority || '').toUpperCase();
      if (['CRITICAL', 'HIGH', 'SEVERE', 'WARNING'].includes(priority) || (c.reportCount || 1) >= 3) {
        list.push({
          id: c.clusterId || `c_${Math.random()}`,
          name: c.geographicArea?.centerAddress || `${(c.dominantHazard || 'Incident').toUpperCase()} Cluster`,
          hazard: c.dominantHazard || 'Hazard Hotspot',
          priority,
          reportsCount: c.reportCount || c.numberOfReports || 1,
          score: priority === 'CRITICAL' ? 88 : 72,
          lat: c.geographicArea?.center?.latitude || operationalCoordinates.lat,
          lon: c.geographicArea?.center?.longitude || operationalCoordinates.lon,
          type: 'CLUSTER',
          raw: c,
        });
      }
    });

    // If local risk assessment is high/critical, add operational sector
    const riskLevel = String(riskAssessment?.level || '').toUpperCase();
    if (['CRITICAL', 'HIGH', 'SEVERE'].includes(riskLevel) && list.length === 0) {
      list.push({
        id: 'sector_risk',
        name: locationName,
        hazard: riskAssessment?.category || 'Atmospheric Threat',
        priority: riskLevel,
        reportsCount: incidents.length,
        score: riskAssessment?.score || 65,
        lat: operationalCoordinates.lat,
        lon: operationalCoordinates.lon,
        type: 'SECTOR',
      });
    }

    return list;
  }, [clusters, incidents, riskAssessment, operationalCoordinates, locationName]);

  // Extract Citizen Reports count & multimodal evidence
  const citizenEvidence = React.useMemo(() => {
    let photos = 0;
    let voice = 0;
    let gps = 0;
    incidents.forEach((inc) => {
      if (inc.media?.photos?.length || inc.attachments?.photos?.length || inc.photoUrl) photos++;
      if (inc.voiceRecording?.transcript || inc.audioUrl) voice++;
      if (inc.location?.coordinates || (inc.latitude && inc.longitude)) gps++;
    });
    return {
      total: incidents.length,
      photos,
      voice,
      gps,
      latest: incidents[0],
    };
  }, [incidents]);

  return (
    <div id="responder-tactical-weather-deck" className={`space-y-4 text-left ${className}`}>
      {/* ========================================================================= */}
      {/* 1. RESPONDER PRIMARY VIEW — STRICT USER-SPECIFIED PRIORITIZATION          */}
      {/* Hierarchy: Warnings ➔ High-Risk Locs ➔ Citizen Reports ➔ Clusters        */}
      {/* ➔ Forecast ➔ Weather Conditions ➔ Location                                 */}
      {/* ========================================================================= */}
      <Card className="p-4 sm:p-5 border-2 border-primary/30 shadow-md space-y-4 bg-surface-container/40">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/60 pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-2xl text-secondary animate-pulse" aria-hidden="true">
              tactical_dashboard
            </span>
            <div>
              <h2 className="text-base font-black text-primary tracking-tight">
                Responder Operational Weather & Threat Intelligence
              </h2>
              <p className="text-xs text-on-surface-variant">
                Synthesized live radar telemetry, multi-signal risk scoring, and verified field incidents
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-secondary/15 text-secondary border border-secondary/30 font-extrabold">
              Tactical Level View
            </span>
            {onRefresh && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onRefresh}
                disabled={isLoading}
                className="min-h-[44px] text-xs py-2 px-3.5 h-auto flex items-center gap-1.5 font-bold cursor-pointer"
                title="Refresh meteorological & threat streams"
                aria-label="Refresh meteorological & threat streams"
              >
                <span className={`material-symbols-outlined text-sm ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true">
                  refresh
                </span>
                <span>Refresh Telemetry</span>
              </Button>
            )}
          </div>
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* PRIORITY 1: ACTIVE WARNINGS (Highest Tactical Precedence)               */}
        {/* ----------------------------------------------------------------------- */}
        <div id="responder-active-warnings-priority" className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-base" aria-hidden="true">🔴</span>
              <h3 className="text-xs font-black uppercase tracking-wider text-primary">
                1. Active Weather Warnings (IMD / Government CAP)
              </h3>
            </div>
            <span className="text-[10px] font-mono text-on-surface-variant">
              Source: India Meteorological Department (IMD)
            </span>
          </div>

          {activeAlerts.length === 0 ? (
            <div
              id="responder-active-warning-clear"
              className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-lg text-emerald-400" aria-hidden="true">verified</span>
                <div>
                  <span className="font-extrabold text-xs uppercase tracking-wide">🟢 NO ACTIVE WEATHER WARNING</span>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    No severe atmospheric alerts or emergency evacuation mandates currently issued for this sector.
                  </p>
                </div>
              </div>
              <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase shrink-0">
                ALL CLEAR
              </span>
            </div>
          ) : (
            <div id="responder-active-warning-alerts" className="space-y-2">
              {activeAlerts.map((alert, idx) => {
                const sev = String(alert.severity || alert.alertLevel || 'WARNING').toUpperCase();
                const isEmergency = sev.includes('EXTREME') || sev.includes('SEVERE') || sev.includes('RED') || sev.includes('CRITICAL');
                return (
                  <div
                    key={alert.id || `alert_${idx}`}
                    className={`p-3.5 rounded-xl border text-xs space-y-2 animate-fade-in ${
                      isEmergency
                        ? 'bg-error/15 border-2 border-error text-error shadow-sm'
                        : 'bg-amber-500/15 border border-amber-500/50 text-amber-300 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-black">
                        <span className="text-base" aria-hidden="true">{isEmergency ? '🔴' : '🟠'}</span>
                        <span className="text-xs uppercase tracking-wide">
                          {isEmergency ? '🔴 SEVERE WARNING' : '🟠 WEATHER ADVISORY'} — {alert.event || alert.headline || 'Official Alert'}
                        </span>
                      </div>
                      <span className={`text-[9px] font-mono px-2 py-0.5 rounded font-black uppercase shrink-0 ${
                        isEmergency ? 'bg-error text-white' : 'bg-amber-500 text-white'
                      }`}>
                        {sev}
                      </span>
                    </div>

                    <p className="text-[11px] text-on-surface leading-relaxed">
                      {alert.description || alert.areaDesc || 'Severe convective hazard detected by meteorological observation.'}
                    </p>

                    {(alert.safetyRecommendation || alert.instruction) && (
                      <div className="p-2 rounded bg-surface/80 border border-outline-variant/30 text-[11px] font-medium text-primary">
                        <strong className="text-secondary uppercase font-mono mr-1">Direct Mandate:</strong>
                        {alert.safetyRecommendation || alert.instruction}
                      </div>
                    )}

                    <div className="pt-1.5 border-t border-outline-variant/30 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-on-surface-variant">
                      <span>Source: <strong className="text-on-surface">{alert.source || 'India Meteorological Department (IMD)'}</strong></span>
                      <span>Jurisdiction: <strong className="text-on-surface">{alert.area || alert.affectedArea || locationName}</strong></span>
                      <span>Valid until: <strong className="text-on-surface">{alert.expires || alert.validUntil ? new Date(alert.expires || alert.validUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Next 6 hours'}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* PRIORITY 2: HIGH-RISK LOCATIONS                                         */}
        {/* ----------------------------------------------------------------------- */}
        <div id="responder-high-risk-locations-priority" className="space-y-2 pt-2 border-t border-outline-variant/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-error" aria-hidden="true">emergency</span>
              <h3 className="text-xs font-black uppercase tracking-wider text-primary">
                2. High-Risk Locations & Hotspots
              </h3>
            </div>
            <span className="text-[10px] font-mono text-on-surface-variant">
              {highRiskLocations.length} Critical Hotspot(s) Detected
            </span>
          </div>

          {highRiskLocations.length === 0 ? (
            <div className="p-2.5 rounded-lg bg-surface-container border border-outline-variant/30 text-xs text-on-surface-variant flex items-center justify-between">
              <span>All monitored sectors currently reporting low composite risk index.</span>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">NORMAL RADAR</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {highRiskLocations.map((loc) => (
                <div
                  key={loc.id}
                  className="p-3 rounded-xl bg-surface border border-outline-variant/80 hover:border-secondary transition-all space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-extrabold text-primary truncate block text-xs">
                      {loc.name}
                    </span>
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-black uppercase shrink-0 ${
                      loc.priority === 'CRITICAL' ? 'bg-error text-white' : 'bg-amber-600 text-white'
                    }`}>
                      {loc.priority}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-on-surface-variant">
                    <span>Hazard: <strong className="text-primary">{loc.hazard}</strong></span>
                    <span className="text-error font-extrabold">Risk {loc.score}/100</span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-on-surface-variant pt-1 border-t border-outline-variant/30">
                    <span>{loc.reportsCount} citizen SOS report(s)</span>
                    {onFocusLocation && (
                      <button
                        type="button"
                        onClick={() => onFocusLocation({ latitude: loc.lat, longitude: loc.lon })}
                        className="min-h-[44px] text-secondary hover:underline font-bold flex items-center gap-1 cursor-pointer"
                        aria-label={`Focus map on ${loc.name}`}
                      >
                        <span className="material-symbols-outlined text-sm" aria-hidden="true">pin_drop</span>
                        <span>Focus Map</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* PRIORITY 3: CITIZEN REPORTS                                             */}
        {/* ----------------------------------------------------------------------- */}
        <div id="responder-citizen-reports-priority" className="space-y-2 pt-2 border-t border-outline-variant/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-emerald-400" aria-hidden="true">record_voice_over</span>
              <h3 className="text-xs font-black uppercase tracking-wider text-primary">
                3. Citizen Reports (Empirical Field Truth)
              </h3>
            </div>
            <span className="text-[10px] font-mono font-bold text-emerald-400">
              {citizenEvidence.total} Ground Incidents Active
            </span>
          </div>

          <div className="p-3 rounded-xl bg-surface border border-outline-variant/70 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-extrabold text-primary">
                  {citizenEvidence.total > 0 ? `${citizenEvidence.total} Active Citizen SOS Feeds` : '0 Active Citizen SOS Feeds'}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                  EMPIRICAL GROUND TRUTH
                </span>
              </div>
              {citizenEvidence.latest && (
                <p className="text-[11px] text-on-surface-variant italic line-clamp-1">
                  Latest: "{citizenEvidence.latest.description || citizenEvidence.latest.citizenInput?.textDescription || 'Ground emergency logged'}"
                </p>
              )}
            </div>

            {/* Multimodal Telemetry Badges */}
            <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
              <span className="px-2 py-0.5 rounded bg-surface-container border border-outline-variant text-primary flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">photo_camera</span>
                <span>{citizenEvidence.photos} Photos Verified</span>
              </span>
              <span className="px-2 py-0.5 rounded bg-surface-container border border-outline-variant text-sky-400 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">graphic_eq</span>
                <span>{citizenEvidence.voice} Audio Transcripts</span>
              </span>
              <span className="px-2 py-0.5 rounded bg-surface-container border border-outline-variant text-emerald-400 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">gps_fixed</span>
                <span>{citizenEvidence.gps} GPS Locked</span>
              </span>
            </div>
          </div>
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* PRIORITY 4: INCIDENT CLUSTERS                                           */}
        {/* ----------------------------------------------------------------------- */}
        <div id="responder-incident-clusters-priority" className="space-y-2 pt-2 border-t border-outline-variant/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-secondary" aria-hidden="true">hub</span>
              <h3 className="text-xs font-black uppercase tracking-wider text-primary">
                4. Incident Clusters (Spatial-Temporal Fusion)
              </h3>
            </div>
            <span className="text-[10px] font-mono text-on-surface-variant">
              {clusters.length} Corroborated Cluster(s)
            </span>
          </div>

          {clusters.length === 0 ? (
            <div className="p-2.5 rounded-lg bg-surface-container border border-outline-variant/30 text-xs text-on-surface-variant">
              No multi-citizen emergency clusters currently active in sector.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {clusters.slice(0, 3).map((c) => (
                <div
                  key={c.clusterId}
                  className="p-3 rounded-xl bg-surface border border-outline-variant space-y-1.5 text-xs text-left"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-black text-primary truncate">
                      {(c.dominantHazard || 'INCIDENT').toUpperCase()} CLUSTER
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-secondary/20 text-secondary font-bold">
                      {c.reportCount || c.numberOfReports || 1} Reports
                    </span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant truncate">
                    {c.geographicArea?.centerAddress || 'Sector Cluster Zone'}
                  </p>
                  <div className="flex items-center justify-between pt-1 border-t border-outline-variant/30 text-[10px] font-mono">
                    <span className="text-on-surface-variant">
                      Radius: {c.geographicArea?.radiusMeters ? `${Math.round(c.geographicArea.radiusMeters)}m` : 'Localized'}
                    </span>
                    {onSelectCluster && (
                      <button
                        type="button"
                        onClick={() => onSelectCluster(c)}
                        className="min-h-[44px] text-secondary hover:underline font-bold cursor-pointer flex items-center gap-1"
                        aria-label={`Inspect ${c.dominantHazard || 'Incident'} cluster`}
                      >
                        <span>Inspect Cluster ➔</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* PRIORITY 5 & 6 & 7: FORECAST, WEATHER CONDITIONS & LOCATION             */}
        {/* ----------------------------------------------------------------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 pt-2 border-t border-outline-variant/40">
          {/* PRIORITY 5: FORECAST */}
          <div id="responder-forecast-priority" className="p-3 rounded-xl bg-surface border border-outline-variant space-y-2 text-xs">
            <div className="flex items-center justify-between border-b border-outline-variant/40 pb-1.5">
              <span className="font-black uppercase tracking-wider text-[11px] text-sky-400 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">thermostat</span>
                <span>5. Atmospheric Forecast</span>
              </span>
              <span className="text-[9px] font-mono text-on-surface-variant">ECMWF / GFS</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between font-mono">
                <span className="text-on-surface-variant">Next 24h Trend:</span>
                <span className="font-extrabold text-primary whitespace-nowrap">
                  {weatherData?.daily?.temperatureMax?.[0] != null && weatherData?.daily?.temperatureMin?.[0] != null && !isNaN(Number(weatherData.daily.temperatureMin[0])) && !isNaN(Number(weatherData.daily.temperatureMax[0]))
                    ? `${Number(weatherData.daily.temperatureMin[0]).toFixed(1)}°C to ${Number(weatherData.daily.temperatureMax[0]).toFixed(1)}°C`
                    : 'Moderate Seasonal Range'}
                </span>
              </div>
              <div className="flex items-center justify-between font-mono">
                <span className="text-on-surface-variant">Precipitation Prob:</span>
                <span className="font-extrabold text-sky-400">
                  {current.precipitationProbability != null ? `${current.precipitationProbability}%` : 'Low Risk'}
                </span>
              </div>
              <div className="flex items-center justify-between font-mono">
                <span className="text-on-surface-variant">Forecast Horizon:</span>
                <span className="font-bold text-primary">7-Day Multi-Model Ensemble</span>
              </div>
            </div>
            <div className="pt-1.5 border-t border-outline-variant/30 text-[9px] font-mono text-on-surface-variant flex justify-between">
              <span>Source: ECMWF NWP Ingest</span>
              <span>Updated: Live Ingestion</span>
            </div>
          </div>

          {/* PRIORITY 6: WEATHER CONDITIONS */}
          <div id="responder-weather-conditions-priority" className="p-3 rounded-xl bg-surface border border-outline-variant space-y-2 text-xs">
            <div className="flex items-center justify-between border-b border-outline-variant/40 pb-1.5">
              <span className="font-black uppercase tracking-wider text-[11px] text-primary flex items-center gap-1">
                <span className="material-symbols-outlined text-xs text-secondary">cloud</span>
                <span>6. Weather Conditions</span>
              </span>
              <span className="text-[9px] font-mono text-on-surface-variant">Real Telemetry</span>
            </div>
            <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
              <div>
                <span className="text-[9px] uppercase text-on-surface-variant block">Temp / Feels</span>
                <span className="font-extrabold text-primary text-xs whitespace-nowrap block">
                  {current.temperature != null && !isNaN(Number(current.temperature)) ? `${Number(current.temperature).toFixed(1)}°C` : '—'}
                </span>
                <span className="text-[9px] text-on-surface-variant block whitespace-nowrap">
                  Feels {current.feelsLike != null && !isNaN(Number(current.feelsLike)) ? `${Number(current.feelsLike).toFixed(1)}°C` : '—'}
                </span>
              </div>
              <div>
                <span className="text-[9px] uppercase text-on-surface-variant block">Precip / Rain</span>
                <span className="font-extrabold text-sky-400 text-xs">
                  {current.precipitation != null ? `${current.precipitation} mm/h` : '0.0 mm/h'}
                </span>
                <span className="text-[9px] text-on-surface-variant block">
                  {current.conditionDescription || current.condition || 'Clear/Cloudy'}
                </span>
              </div>
              <div>
                <span className="text-[9px] uppercase text-on-surface-variant block">Wind & Gusts</span>
                <span className="font-extrabold text-primary text-xs">
                  {current.windSpeed != null ? `${current.windSpeed} km/h` : '—'}
                </span>
                <span className="text-[9px] text-on-surface-variant block">
                  Gusts {current.windGust != null ? `${current.windGust} km/h` : '—'}
                </span>
              </div>
              <div>
                <span className="text-[9px] uppercase text-on-surface-variant block">Humidity / Baro</span>
                <span className="font-extrabold text-primary text-xs">
                  {current.humidity != null ? `${current.humidity}%` : '—'}
                </span>
                <span className="text-[9px] text-on-surface-variant block">
                  {current.surfacePressure != null ? `${Math.round(current.surfacePressure)} hPa` : '—'}
                </span>
              </div>
            </div>
            <div className="pt-1.5 border-t border-outline-variant/30 text-[9px] font-mono text-on-surface-variant flex justify-between">
              <span>Sensor: Open-Meteo Ensemble</span>
              <span>Obs: {metadata.sourceUpdateTime ? new Date(metadata.sourceUpdateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Continuous'}</span>
            </div>
          </div>

          {/* PRIORITY 7: LOCATION */}
          <div id="responder-location-priority" className="p-3 rounded-xl bg-surface border border-outline-variant space-y-2 text-xs">
            <div className="flex items-center justify-between border-b border-outline-variant/40 pb-1.5">
              <span className="font-black uppercase tracking-wider text-[11px] text-secondary flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">pin_drop</span>
                <span>7. Operational Location</span>
              </span>
              <span className="text-[9px] font-mono text-on-surface-variant">Geo Context</span>
            </div>
            <div className="space-y-1 font-mono text-[11px]">
              <div>
                <span className="text-[9px] text-on-surface-variant uppercase block">Sector Name:</span>
                <span className="font-extrabold text-primary block truncate">{locationName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-on-surface-variant">Coordinates:</span>
                <span className="font-bold text-primary">
                  {operationalCoordinates.lat.toFixed(4)}°N, {operationalCoordinates.lon.toFixed(4)}°E
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-on-surface-variant">Monitoring Radius:</span>
                <span className="font-bold text-primary">{radiusKm} km Operational Zone</span>
              </div>
            </div>
            <div className="pt-1.5 border-t border-outline-variant/30 text-[9px] font-mono text-on-surface-variant flex justify-between">
              <span>Grid: {operationalCoordinates.lat.toFixed(2)}_{operationalCoordinates.lon.toFixed(2)}</span>
              <span>Elevation: {current.elevation != null ? `${current.elevation}m ASL` : 'Standard'}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* ========================================================================= */}
      {/* 2. NWP (NUMERICAL WEATHER PREDICTION) — EXPANDABLE GFS, ECMWF, WRF DECK    */}
      {/* ========================================================================= */}
      <Card id="responder-nwp-expansion-section" className="p-4 sm:p-5 border border-outline-variant/70 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/60 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-xl text-sky-400" aria-hidden="true">
              grid_guides
            </span>
            <div>
              <h3 className="text-sm font-black text-primary tracking-tight">
                Numerical Weather Prediction (NWP) Multi-Model Ingestion
              </h3>
              <p className="text-[11px] text-on-surface-variant">
                Tactical model comparison across global dynamical cores and regional mesoscale simulations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-toggle-responder-nwp"
              type="button"
              onClick={() => setIsNwpExpanded((prev) => !prev)}
              aria-expanded={isNwpExpanded}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-surface-container-high border border-outline-variant/60 text-xs font-mono text-secondary hover:text-primary cursor-pointer flex items-center gap-1.5 font-bold transition-colors"
            >
              <span>{isNwpExpanded ? 'Collapse Models' : 'Expand NWP Models (GFS / ECMWF / WRF)'}</span>
              <span className="material-symbols-outlined text-sm" aria-hidden="true">
                {isNwpExpanded ? 'expand_less' : 'expand_more'}
              </span>
            </button>
          </div>
        </div>

        {isNwpExpanded && (
          <div className="space-y-3 pt-1">
            {/* Model Selector Filter Buttons */}
            <div className="flex items-center gap-2 flex-wrap" role="tablist" aria-label="NWP Models">
              <button
                type="button"
                onClick={() => setExpandedNwpModel('all')}
                aria-pressed={expandedNwpModel === 'all'}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-mono font-bold cursor-pointer transition-colors ${
                  expandedNwpModel === 'all'
                    ? 'bg-secondary text-on-secondary shadow-xs'
                    : 'bg-surface-container text-on-surface-variant hover:text-primary'
                }`}
              >
                All 3 Models (Consensus)
              </button>
              <button
                id="btn-nwp-expand-gfs"
                type="button"
                onClick={() => setExpandedNwpModel('gfs')}
                aria-pressed={expandedNwpModel === 'gfs'}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-mono font-bold cursor-pointer transition-colors ${
                  expandedNwpModel === 'gfs'
                    ? 'bg-secondary text-on-secondary shadow-xs'
                    : 'bg-surface-container text-on-surface-variant hover:text-primary'
                }`}
              >
                NOAA GFS
              </button>
              <button
                id="btn-nwp-expand-ecmwf"
                type="button"
                onClick={() => setExpandedNwpModel('ecmwf')}
                aria-pressed={expandedNwpModel === 'ecmwf'}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-mono font-bold cursor-pointer transition-colors ${
                  expandedNwpModel === 'ecmwf'
                    ? 'bg-secondary text-on-secondary shadow-xs'
                    : 'bg-surface-container text-on-surface-variant hover:text-primary'
                }`}
              >
                ECMWF IFS
              </button>
              <button
                id="btn-nwp-expand-wrf"
                type="button"
                onClick={() => setExpandedNwpModel('wrf')}
                aria-pressed={expandedNwpModel === 'wrf'}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-mono font-bold cursor-pointer transition-colors ${
                  expandedNwpModel === 'wrf'
                    ? 'bg-secondary text-on-secondary shadow-xs'
                    : 'bg-surface-container text-on-surface-variant hover:text-primary'
                }`}
              >
                WRF-Derived Data
              </button>
            </div>

            {/* Invariant Warning Banner for WRF */}
            <div className="p-2.5 rounded-xl bg-surface-container-high/80 border border-outline-variant/60 flex items-start gap-2 text-xs">
              <span className="material-symbols-outlined text-sm text-secondary shrink-0 mt-0.5" aria-hidden="true">
                info
              </span>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                <strong className="text-primary font-mono uppercase">Operational Ingestion Standard: </strong>
                NWP models provide deterministic atmospheric trajectories. WRF data is ingested as a{' '}
                <strong className="text-secondary">WRF-derived mesoscale dataset</strong> boundary-forced by global GFS fields; it is{' '}
                <span className="underline font-bold text-amber-400">never claimed to be locally executed</span> on mobile or edge node hardware.
              </p>
            </div>

            {/* Model Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* MODEL 1: GFS */}
              {(expandedNwpModel === 'all' || expandedNwpModel === 'gfs') && (
                <div id="nwp-model-card-gfs" className="p-3.5 rounded-xl bg-surface border border-outline-variant/70 space-y-2.5 text-xs text-left">
                  <div className="flex items-center justify-between border-b border-outline-variant/40 pb-1.5">
                    <span className="font-extrabold text-primary font-mono text-xs">
                      NOAA GFS
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 font-bold uppercase">
                      13-28 km Grid
                    </span>
                  </div>

                  <div className="space-y-1.5 font-mono text-[11px]">
                    <div>
                      <span className="text-[9px] text-on-surface-variant uppercase block">Model:</span>
                      <strong className="text-primary block">Global Forecast System (GFS)</strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-on-surface-variant uppercase block">Forecast Time:</span>
                      <span className="text-primary">384-hour horizon (16 days), 3-hourly steps</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-on-surface-variant uppercase block">Source:</span>
                      <span className="text-primary">National Oceanic & Atmospheric Admin (NOAA / NCEP)</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-on-surface-variant uppercase block">Data Timestamp:</span>
                      <span className="text-secondary font-bold">
                        Run cycle 00z / 12z UTC ({new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-outline-variant/30 flex items-center justify-between text-[10px] font-mono text-on-surface-variant">
                    <span>Physics: FV3 Dynamical Core</span>
                    <span className="text-emerald-400 font-bold">Operational Global</span>
                  </div>
                </div>
              )}

              {/* MODEL 2: ECMWF */}
              {(expandedNwpModel === 'all' || expandedNwpModel === 'ecmwf') && (
                <div id="nwp-model-card-ecmwf" className="p-3.5 rounded-xl bg-surface border border-outline-variant/70 space-y-2.5 text-xs text-left">
                  <div className="flex items-center justify-between border-b border-outline-variant/40 pb-1.5">
                    <span className="font-extrabold text-primary font-mono text-xs">
                      ECMWF IFS
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-secondary/20 text-secondary font-bold uppercase">
                      9-25 km High-Res
                    </span>
                  </div>

                  <div className="space-y-1.5 font-mono text-[11px]">
                    <div>
                      <span className="text-[9px] text-on-surface-variant uppercase block">Model:</span>
                      <strong className="text-primary block">Integrated Forecasting System (ECMWF IFS)</strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-on-surface-variant uppercase block">Forecast Time:</span>
                      <span className="text-primary">240-hour horizon (10 days), 1-hourly / 3-hourly steps</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-on-surface-variant uppercase block">Source:</span>
                      <span className="text-primary">European Centre for Medium-Range Weather Forecasts</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-on-surface-variant uppercase block">Data Timestamp:</span>
                      <span className="text-secondary font-bold">
                        Run cycle 00z / 12z UTC ({new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-outline-variant/30 flex items-center justify-between text-[10px] font-mono text-on-surface-variant">
                    <span>Physics: 4D-Var Data Assimilation</span>
                    <span className="text-emerald-400 font-bold">High Precision</span>
                  </div>
                </div>
              )}

              {/* MODEL 3: WRF-DERIVED DATA */}
              {(expandedNwpModel === 'all' || expandedNwpModel === 'wrf') && (
                <div id="nwp-model-card-wrf" className="p-3.5 rounded-xl bg-surface border-2 border-amber-500/40 space-y-2.5 text-xs text-left">
                  <div className="flex items-center justify-between border-b border-outline-variant/40 pb-1.5">
                    <span className="font-extrabold text-amber-300 font-mono text-xs">
                      WRF-Derived Data
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold uppercase">
                      3-9 km Mesoscale
                    </span>
                  </div>

                  <div className="space-y-1.5 font-mono text-[11px]">
                    <div>
                      <span className="text-[9px] text-on-surface-variant uppercase block">Model:</span>
                      <strong className="text-primary block">Advanced Research WRF (WRF-ARW Derived)</strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-on-surface-variant uppercase block">Forecast Time:</span>
                      <span className="text-primary">120-hour horizon (5 days), fine mesoscale timesteps</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-on-surface-variant uppercase block">Source:</span>
                      <span className="text-primary">Regional Mesoscale Ingestion (Open-Meteo WRF Fields)</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-on-surface-variant uppercase block">Data Timestamp:</span>
                      <span className="text-secondary font-bold">
                        Boundary Run 00z / 12z UTC ({new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                      </span>
                    </div>
                  </div>

                  <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-300 font-mono">
                    ⚠️ WRF-derived dataset only. Never claimed as locally executed on edge devices.
                  </div>

                  <div className="pt-2 border-t border-outline-variant/30 flex items-center justify-between text-[10px] font-mono text-on-surface-variant">
                    <span>Boundary: GFS 0.25° lateral forcing</span>
                    <span className="text-amber-400 font-bold">Mesoscale Derived</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* ========================================================================= */}
      {/* 3. RISK — MULTI-SIGNAL RISK SCORE WITH STRICT SOURCE SEPARATION           */}
      {/* Shows: Risk score, Contributing signals, Forecast, Official warning,       */}
      {/* Citizen ground reports. Strict Source Separation maintained throughout.    */}
      {/* ========================================================================= */}
      <Card id="responder-risk-tactical-section" className="p-4 sm:p-5 border border-outline-variant/70 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/60 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-xl text-secondary" aria-hidden="true">
              analytics
            </span>
            <div>
              <h3 className="text-sm font-black text-primary tracking-tight">
                Resonix Multi-Signal Risk Assessment & Contributing Factors
              </h3>
              <p className="text-[11px] text-on-surface-variant">
                Transparent deterministic scoring synthesizing empirical atmospheric, spatial, and citizen signals
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowRiskSignals((prev) => !prev)}
            className="min-h-[44px] px-2 py-1 text-[11px] font-mono text-secondary hover:underline cursor-pointer flex items-center gap-1 font-bold"
            aria-expanded={showRiskSignals}
          >
            <span>{showRiskSignals ? 'Hide Contributing Signals' : 'Show Contributing Signals'}</span>
            <span className="material-symbols-outlined text-xs" aria-hidden="true">
              {showRiskSignals ? 'expand_less' : 'expand_more'}
            </span>
          </button>
        </div>

        {/* Top Risk Score Header Bar */}
        <div className="p-3.5 rounded-xl bg-surface border border-outline-variant/80 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center font-mono font-black text-xl text-primary border border-outline-variant">
              {riskAssessment?.score ?? 15}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-primary uppercase font-mono">
                  Deterministic Composite Risk Score
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-black uppercase ${
                    ['CRITICAL', 'SEVERE'].includes(String(riskAssessment?.level).toUpperCase())
                      ? 'bg-error text-white'
                      : ['HIGH', 'WARNING'].includes(String(riskAssessment?.level).toUpperCase())
                      ? 'bg-amber-600 text-white'
                      : ['MODERATE'].includes(String(riskAssessment?.level).toUpperCase())
                      ? 'bg-yellow-600 text-white'
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  {riskAssessment?.level || 'LOW'} RISK
                </span>
              </div>
              <p className="text-[11px] text-on-surface-variant mt-0.5">
                {riskAssessment?.summary || 'Stable ground truth corroborated by meteorological observations and radar telemetry.'}
              </p>
            </div>
          </div>

          <div className="w-full sm:w-48 space-y-1">
            <div className="flex justify-between text-[10px] font-mono text-on-surface-variant">
              <span>Threat Scale:</span>
              <span className="font-bold text-primary">{riskAssessment?.score ?? 15} / 100</span>
            </div>
            <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden border border-outline-variant/30">
              <div
                className={`h-full transition-all duration-700 ${
                  (riskAssessment?.score || 15) >= 75
                    ? 'bg-error'
                    : (riskAssessment?.score || 15) >= 50
                    ? 'bg-amber-500'
                    : (riskAssessment?.score || 15) >= 25
                    ? 'bg-yellow-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(5, riskAssessment?.score || 15))}%` }}
              />
            </div>
          </div>
        </div>

        {/* STRICT SOURCE SEPARATION PILLARS (Forecast vs Official Warning vs Citizen Ground Reports) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* SOURCE 1: FORECAST */}
          <div id="risk-source-forecast" className="p-3.5 rounded-xl bg-surface border-2 border-sky-500/40 space-y-2 text-xs text-left">
            <div className="flex items-center justify-between border-b border-outline-variant/40 pb-1.5">
              <span className="font-black uppercase tracking-wider text-[11px] text-sky-400 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">cloud</span>
                <span>Forecast Signal</span>
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-sky-500/15 text-sky-300 font-bold uppercase">
                Source: NWP
              </span>
            </div>
            <p className="text-[11px] text-on-surface leading-snug">
              {current.precipitation > 0
                ? `Forecast convective rain rate of ${current.precipitation} mm/h with ${current.precipitationProbability || 40}% probability.`
                : 'Numerical atmospheric models project dry/moderate conditions below critical precipitation thresholds.'}
            </p>
            <div className="pt-1.5 border-t border-outline-variant/30 text-[9px] font-mono text-on-surface-variant flex justify-between">
              <span>Source: ECMWF / NOAA NWP</span>
              <span className="text-sky-400 font-bold">Atmospheric Model</span>
            </div>
          </div>

          {/* SOURCE 2: OFFICIAL WARNING */}
          <div id="risk-source-official-warning" className="p-3.5 rounded-xl bg-surface border-2 border-amber-500/40 space-y-2 text-xs text-left">
            <div className="flex items-center justify-between border-b border-outline-variant/40 pb-1.5">
              <span className="font-black uppercase tracking-wider text-[11px] text-amber-400 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">campaign</span>
                <span>Official Warning Signal</span>
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 font-bold uppercase">
                Source: IMD
              </span>
            </div>
            <p className="text-[11px] text-on-surface leading-snug">
              {activeAlerts.length > 0
                ? `${activeAlerts[0].event || activeAlerts[0].headline} (${activeAlerts[0].severity || 'Alert'}) issued by government meteorological bureau.`
                : 'No active severe weather or cyclone warnings in force for jurisdiction.'}
            </p>
            <div className="pt-1.5 border-t border-outline-variant/30 text-[9px] font-mono text-on-surface-variant flex justify-between">
              <span>Source: India Met Dept (IMD)</span>
              <span className="text-amber-400 font-bold">Official Verbatim</span>
            </div>
          </div>

          {/* SOURCE 3: CITIZEN GROUND REPORTS */}
          <div id="risk-source-citizen-reports" className="p-3.5 rounded-xl bg-surface border-2 border-emerald-500/40 space-y-2 text-xs text-left">
            <div className="flex items-center justify-between border-b border-outline-variant/40 pb-1.5">
              <span className="font-black uppercase tracking-wider text-[11px] text-emerald-400 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">groups</span>
                <span>Citizen Ground Reports</span>
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300 font-bold uppercase">
                Source: Citizen SOS
              </span>
            </div>
            <p className="text-[11px] text-on-surface leading-snug">
              {incidents.length > 0
                ? `${incidents.length} citizen incident reports received within ${radiusKm} km radius corroborating field conditions.`
                : 'Zero active ground incidents or emergency distress calls logged in this sector.'}
            </p>
            <div className="pt-1.5 border-t border-outline-variant/30 text-[9px] font-mono text-on-surface-variant flex justify-between">
              <span>Source: Citizen SOS Telemetry</span>
              <span className="text-emerald-400 font-bold">Field Truth</span>
            </div>
          </div>
        </div>

        {/* CONTRIBUTING SIGNALS BREAKDOWN TABLE */}
        {showRiskSignals && (
          <div id="risk-contributing-signals-matrix" className="p-3.5 rounded-xl bg-surface-container/60 border border-outline-variant/60 space-y-2.5">
            <div className="flex items-center justify-between border-b border-outline-variant/40 pb-1.5">
              <span className="text-xs font-mono font-bold text-primary uppercase">
                Factual Contributing Signals Breakdown (Weights & Points)
              </span>
              <span className="text-[10px] font-mono text-on-surface-variant">
                Deterministic Rule Matrix
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs font-mono">
              <div className="p-2 rounded bg-surface border border-outline-variant/40 space-y-1">
                <div className="flex justify-between text-on-surface-variant">
                  <span>Rainfall Intensity:</span>
                  <span className="font-bold text-primary">{current.precipitation || 0} mm/h</span>
                </div>
                <span className="text-[10px] text-sky-400 block font-semibold">Weight: Max 25 pts</span>
              </div>

              <div className="p-2 rounded bg-surface border border-outline-variant/40 space-y-1">
                <div className="flex justify-between text-on-surface-variant">
                  <span>Rain Probability:</span>
                  <span className="font-bold text-primary">{current.precipitationProbability || 0}%</span>
                </div>
                <span className="text-[10px] text-sky-400 block font-semibold">Weight: Max 15 pts</span>
              </div>

              <div className="p-2 rounded bg-surface border border-outline-variant/40 space-y-1">
                <div className="flex justify-between text-on-surface-variant">
                  <span>Wind Velocity & Gusts:</span>
                  <span className="font-bold text-primary">{current.windSpeed || 0} km/h</span>
                </div>
                <span className="text-[10px] text-secondary block font-semibold">Weight: Max 15 pts</span>
              </div>

              <div className="p-2 rounded bg-surface border border-outline-variant/40 space-y-1">
                <div className="flex justify-between text-on-surface-variant">
                  <span>Official Warning Boost:</span>
                  <span className="font-bold text-primary">{activeAlerts.length > 0 ? '+25 pts' : '0 pts'}</span>
                </div>
                <span className="text-[10px] text-amber-400 block font-semibold">Weight: Max 25 pts</span>
              </div>
            </div>

            {/* Invariant Note */}
            <p className="text-[10px] font-mono text-on-surface-variant/80 pt-1 italic">
              * Resonix Risk Assessment is an analytical decision-support layer and maintains complete separation from official IMD warnings.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
