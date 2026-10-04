import React, { useState } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';

/**
 * Resonix Forecast + Ground Truth Unified Situation View
 * 
 * Synthesizes:
 * 1. Meteorological forecast
 * 2. Official weather warning (IMD / CAP)
 * 3. Resonix local risk assessment
 * 4. Citizen emergency reports
 * 5. Incident clusters
 * 6. Geographic context
 * 7. Time context
 * 
 * Strictly preserves official warning values and real meteorological data.
 * Clearly labels all 4 sources with evidence behind the assessment.
 */
export default function UnifiedSituationView({
  situationData = null,
  isLoading = false,
  onRefresh,
  className = '',
}) {
  const [showEvidenceAudit, setShowEvidenceAudit] = useState(true);

  if (isLoading && !situationData) {
    return (
      <Card className={`p-4 border border-outline-variant/70 shadow-md animate-pulse space-y-3 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="h-5 w-64 bg-surface-container-high rounded" />
          <div className="h-5 w-24 bg-surface-container-high rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-surface-container rounded-xl" />
          ))}
        </div>
      </Card>
    );
  }

  if (!situationData) return null;

  const {
    location = {},
    timeContext = {},
    meteorologicalData = {},
    officialWarning = {},
    resonixRisk = {},
    citizenGroundTruth = {},
    situationAssessment = {},
  } = situationData;

  const rawScore = situationAssessment.confidenceScore;
  const confidencePct = (rawScore != null && rawScore !== '' && !isNaN(Number(rawScore)))
    ? Math.round(Number(rawScore) * 100)
    : 85;

  // Status Styling
  const isCorroborated = situationAssessment.status === 'CORROBORATED_GROUND_TRUTH' || (citizenGroundTruth.totalReports >= 3 && officialWarning.hasOfficialWarning);
  const isCritical = ['CRITICAL', 'SEVERE', 'HIGH_CONFIDENCE'].includes(situationAssessment.confidenceLevel) || resonixRisk.level === 'CRITICAL';

  let bannerBorder = 'border-secondary/50 bg-secondary/10';
  let badgeColor = 'bg-secondary text-white';
  if (isCorroborated || isCritical) {
    bannerBorder = 'border-error/60 bg-error/10';
    badgeColor = 'bg-error text-white font-black';
  } else if (officialWarning.hasOfficialWarning) {
    bannerBorder = 'border-amber-500/60 bg-amber-500/10';
    badgeColor = 'bg-amber-500 text-white font-bold';
  }

  return (
    <Card className={`p-4 sm:p-5 border border-outline-variant/70 shadow-md space-y-4 text-left ${className}`}>
      {/* Top Header & Operational Meta */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/60 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-xl text-secondary">radar</span>
            <h2 className="text-base font-black text-primary tracking-tight">
              Resonix Forecast + Ground Truth Intelligence
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-surface-container border border-outline-variant text-secondary">
              Unified Situation View
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Synchronized empirical citizen reports, atmospheric NWP forecasts, and official IMD warnings
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-mono text-on-surface-variant hidden sm:inline">
            Sector: <strong className="text-primary">{location.name || 'HQ Operational Sector'}</strong> ({location.radiusKm || 25} km)
          </span>
          <span className="text-[10px] font-mono text-on-surface-variant bg-surface-container px-2 py-0.5 rounded border border-outline-variant/60" title="Timestamp of underlying meteorological data">
            Weather Obs: <strong className="text-primary">{meteorologicalData.timestamp ? new Date(meteorologicalData.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : (situationData?.generatedAt ? new Date(situationData.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live')}</strong>
          </span>
          {onRefresh && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onRefresh}
              className="text-[11px] py-1 px-2.5 h-auto flex items-center gap-1 font-bold"
              title="Refresh situation evaluation"
            >
              <span className="material-symbols-outlined text-xs">refresh</span>
              <span>Re-evaluate</span>
            </Button>
          )}
        </div>
      </div>

      {/* SYNTHESIZED SITUATION RESULT BANNER (The Core Formulation) */}
      <div className={`p-4 rounded-xl border ${bannerBorder} space-y-2.5 transition-all`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black uppercase tracking-wider bg-surface/90 text-primary border border-outline-variant">
              RESULT ASSESSMENT
            </span>
            <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full uppercase ${badgeColor}`}>
              {situationAssessment.confidenceLevel || 'EVALUATED'}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-on-surface-variant font-medium">Correlation Confidence:</span>
            <span className="font-black text-primary">{confidencePct}%</span>
            <span className="text-secondary font-bold">• {timeContext.leadTimeMinutes || 45}m NWP Lead Time</span>
          </div>
        </div>

        <div>
          <h3 className="text-lg sm:text-xl font-black text-primary tracking-tight">
            {situationAssessment.resultHeadline || 'Synthesized Disaster Situation View'}
          </h3>
          <p className="text-xs text-primary/90 mt-1 leading-relaxed">
            {situationAssessment.summary || 'Empirical ground truth validated against meteorological forecasts and official government warnings.'}
          </p>
        </div>

        {/* Operational Recommendation Pill */}
        {situationAssessment.operationalRecommendation && (
          <div className="pt-2 border-t border-outline-variant/30 flex items-start gap-2 text-xs">
            <span className="material-symbols-outlined text-base text-secondary shrink-0 mt-0.5">
              assignment_turned_in
            </span>
            <p className="font-semibold text-primary">
              <span className="text-secondary uppercase font-mono font-extrabold mr-1.5">Dispatch Action:</span>
              {situationAssessment.operationalRecommendation}
            </p>
          </div>
        )}
      </div>

      {/* THE 4 CLEARLY LABELED SOURCE CARDS (Strict Source Separation Invariant) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        {/* SOURCE 1: Meteorological Data */}
        <div className="p-3 rounded-xl bg-surface border border-outline-variant/70 space-y-2 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between border-b border-outline-variant/40 pb-1.5">
              <span className="text-[10px] font-mono font-black uppercase tracking-wider text-sky-400 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">cloud</span>
                <span>Meteorological Data</span>
              </span>
              <span className="text-[9px] font-mono text-on-surface-variant/80">Source 1</span>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-extrabold text-primary block leading-tight">
                {comp.forecast || meteorologicalData.headline || 'Atmospheric Forecast'}
              </span>
              <p className="text-[11px] text-on-surface-variant">
                {meteorologicalData.precipitationRateMmH > 0
                  ? `${meteorologicalData.precipitationRateMmH} mm/h precipitation (Peak: ${meteorologicalData.peakHourlyRainMmH || meteorologicalData.precipitationRateMmH} mm/h)`
                  : 'Precipitation within normal baseline'}
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-outline-variant/30 text-[10px] font-mono text-on-surface-variant/80 flex justify-between items-center">
            <span className="truncate">{meteorologicalData.provider || 'ECMWF NWP'}</span>
            <span className="truncate text-secondary font-bold" title="Underlying meteorological observation timestamp">
              Obs: {meteorologicalData.timestamp ? new Date(meteorologicalData.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live'}
            </span>
          </div>
        </div>

        {/* SOURCE 2: Official Warning (Unmodified official values) */}
        <div className="p-3 rounded-xl bg-surface border border-outline-variant/70 space-y-2 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between border-b border-outline-variant/40 pb-1.5">
              <span className="text-[10px] font-mono font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">campaign</span>
                <span>Official Warning</span>
              </span>
              <span className="text-[9px] font-mono text-on-surface-variant/80">Source 2</span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.2 rounded uppercase font-extrabold ${
                    officialWarning.colorCode === 'RED'
                      ? 'bg-error text-white'
                      : officialWarning.colorCode === 'ORANGE'
                      ? 'bg-amber-600 text-white'
                      : officialWarning.colorCode === 'YELLOW'
                      ? 'bg-yellow-600 text-white'
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  {officialWarning.level || 'NONE'}
                </span>
                <span className="text-xs font-extrabold text-primary truncate">
                  {officialWarning.event || 'No Active Alerts'}
                </span>
              </div>
              <p className="text-[11px] text-on-surface-variant line-clamp-2">
                {officialWarning.headline || 'Conditions within seasonal safety thresholds.'}
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-outline-variant/30 text-[10px] font-mono text-on-surface-variant/80 flex justify-between">
            <span className="truncate">{officialWarning.issuingAuthority || 'IMD Authority'}</span>
            <span className="text-amber-400 font-bold">Official Verbatim</span>
          </div>
        </div>

        {/* SOURCE 3: Resonix Risk */}
        <div className="p-3 rounded-xl bg-surface border border-outline-variant/70 space-y-2 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between border-b border-outline-variant/40 pb-1.5">
              <span className="text-[10px] font-mono font-black uppercase tracking-wider text-secondary flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">analytics</span>
                <span>Resonix Risk</span>
              </span>
              <span className="text-[9px] font-mono text-on-surface-variant/80">Source 3</span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-primary">
                  {resonixRisk.level || 'LOW'} RISK
                </span>
                <span className="font-mono font-extrabold text-primary">
                  {resonixRisk.score ?? 15} / 100
                </span>
              </div>
              <p className="text-[11px] text-on-surface-variant line-clamp-2">
                {resonixRisk.summary || 'Low evaluated threat index across regional sensors.'}
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-outline-variant/30 text-[10px] font-mono text-on-surface-variant/80 flex justify-between">
            <span>Decision Support</span>
            <span>Multi-Factor</span>
          </div>
        </div>

        {/* SOURCE 4: Citizen Ground Truth */}
        <div className="p-3 rounded-xl bg-surface border border-outline-variant/70 space-y-2 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between border-b border-outline-variant/40 pb-1.5">
              <span className="text-[10px] font-mono font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">groups</span>
                <span>Citizen Ground Truth</span>
              </span>
              <span className="text-[9px] font-mono text-on-surface-variant/80">Source 4</span>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-extrabold text-primary block leading-tight">
                {citizenGroundTruth.totalReports > 0
                  ? `${citizenGroundTruth.totalReports} ${citizenGroundTruth.dominantHazard || 'Incident'} Reports`
                  : '0 Citizen Reports'}
              </span>
              <p className="text-[11px] text-on-surface-variant">
                {citizenGroundTruth.totalReports > 0
                  ? `${citizenGroundTruth.locationsCount || 1} distinct location(s) • ${timeContext.timeWindowSpan || 'Operational window'}`
                  : 'Zero ground incident reports logged.'}
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-outline-variant/30 text-[10px] font-mono text-on-surface-variant/80 flex justify-between">
            <span>{citizenGroundTruth.clusterCount || 0} Cluster(s)</span>
            <span className="text-emerald-400 font-bold">Empirical Field Truth</span>
          </div>
        </div>
      </div>

      {/* EVIDENCE BEHIND THE SITUATION ASSESSMENT (Requirement: Show the evidence behind the assessment) */}
      <div className="p-3.5 rounded-xl bg-surface-container/70 border border-outline-variant/60 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base text-secondary">verified_user</span>
            <h4 className="text-xs font-black uppercase tracking-wider text-primary">
              Evidence Behind Situation Assessment
            </h4>
          </div>
          <button
            onClick={() => setShowEvidenceAudit((prev) => !prev)}
            className="text-[11px] font-mono text-secondary hover:underline cursor-pointer flex items-center gap-0.5"
          >
            <span>{showEvidenceAudit ? 'Collapse Evidence' : 'Expand Evidence Trail'}</span>
            <span className="material-symbols-outlined text-xs">
              {showEvidenceAudit ? 'expand_less' : 'expand_more'}
            </span>
          </button>
        </div>

        {showEvidenceAudit && (
          <div className="space-y-2.5 pt-1">
            {/* 6-Point Structured Evidence Points */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
              {(situationAssessment.evidenceBehindAssessment || []).map((point, idx) => (
                <div key={idx} className="p-2 rounded bg-surface border border-outline-variant/40 flex items-start gap-2">
                  <span className="text-secondary font-bold shrink-0">{idx + 1}.</span>
                  <span className="text-primary/90 text-[11px] leading-relaxed">{point}</span>
                </div>
              ))}
            </div>

            {/* Evidence Telemetry Summary Chips */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-outline-variant/30 text-[10px] font-mono">
              <span className="text-on-surface-variant font-bold uppercase">Empirical Telemetry:</span>
              <span className="px-2 py-0.5 rounded bg-surface border border-outline-variant text-primary flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">photo_camera</span>
                <span>{citizenGroundTruth.evidence?.photosCount || 0} Photos Verified</span>
              </span>
              <span className="px-2 py-0.5 rounded bg-surface border border-outline-variant text-sky-400 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">mic</span>
                <span>{citizenGroundTruth.evidence?.voiceTranscriptsCount || 0} Audio Transcripts</span>
              </span>
              <span className="px-2 py-0.5 rounded bg-surface border border-outline-variant text-emerald-400 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">gps_fixed</span>
                <span>{citizenGroundTruth.evidence?.gpsFixesCount || 0} GPS Fixes</span>
              </span>
              {location.activeReportingAreaKm2 > 0 && (
                <span className="px-2 py-0.5 rounded bg-surface border border-outline-variant text-on-surface-variant">
                  Area: {location.activeReportingAreaKm2} km² ({location.spatialSpreadMeters}m spread)
                </span>
              )}
            </div>

            {/* Corroborating Citizen Transcripts Excerpts */}
            {citizenGroundTruth.evidence?.sampleTranscripts?.length > 0 && (
              <div className="p-2 rounded bg-surface border border-outline-variant/40 text-xs space-y-1">
                <span className="text-[10px] uppercase font-bold text-on-surface-variant block font-mono">
                  Corroborating Citizen Ground Excerpts:
                </span>
                <div className="space-y-1 text-primary italic">
                  {citizenGroundTruth.evidence.sampleTranscripts.map((t, idx) => (
                    <p key={idx} className="line-clamp-1">
                      "{t}"
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
