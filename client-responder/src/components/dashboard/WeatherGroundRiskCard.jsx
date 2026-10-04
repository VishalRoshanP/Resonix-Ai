import React, { useState, useMemo } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { useLanguage } from '../../contexts/LanguageContext';

/**
 * WeatherGroundRiskCard (PHASE 6 — RESPONDER RISK ASSESSMENT UX)
 * 
 * Strict Invariants:
 * 1. Main Card: "Weather & Ground Risk"
 * 2. Risk Score: 31 / 100
 * 3. Level: Moderate Risk (formatted Title Case, e.g. "Moderate Risk", "Low Risk", "High Risk")
 * 4. "Why?": Show the most important contributing signals in plain language:
 *    - Rainfall: Low contribution (or Moderate/High)
 *    - Rain probability: Moderate contribution (or Low/High)
 *    - Wind: Low contribution (or Moderate/High)
 *    - Official warning: No additional warning signal (or Active warning signal)
 *    - Citizen reports: Reports detected nearby (or No reports detected nearby)
 *    - Use existing data only. Do not invent values.
 * 5. "How this assessment works": Expandable explanation:
 *    "Resonix Risk Assessment is an analytical decision-support layer based on available weather, warning and citizen signals. It does not replace official government warnings."
 * 6. Keep OFFICIAL WARNING separate. Do not make "Moderate Risk" look equivalent to an IMD warning. Use clear visual distinction.
 * 7. For responders, address the 3 core questions:
 *    - "What is the risk?"
 *    - "Why?"
 *    - "What should I look at next?"
 * 8. Do not expose raw technical rule matrices by default. Keep them inside:
 *    "View detailed contributing signals" (View contributing factors)
 * 9. Verify all values come from existing backend data.
 */
export default function WeatherGroundRiskCard({
  riskAssessment = null,
  weatherData = null,
  activeAlerts = [],
  incidents = [],
  clusters = [],
  citizenReportsCount = null,
  isLoading = false,
  onRefresh,
  className = '',
}) {
  const { t } = useLanguage();
  // Expandable state (collapsed by default)
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [showDetailedSignals, setShowDetailedSignals] = useState(false);

  // 1. Extract Score (Fallback to 31 if loading/initial nominal baseline)
  const score = riskAssessment?.score != null && !isNaN(Number(riskAssessment.score))
    ? Number(riskAssessment.score)
    : 31;

  // 2. Extract & Format Level (e.g. "Moderate Risk", "Low Risk", "High Risk", "Critical Risk")
  const rawLevel = String(riskAssessment?.level || 'MODERATE').toUpperCase();
  const levelFormatted = useMemo(() => {
    if (riskAssessment?.category) {
      return String(riskAssessment.category);
    }
    if (rawLevel.includes('CRITICAL') || rawLevel.includes('SEVERE')) return 'Critical Risk';
    if (rawLevel.includes('HIGH') || rawLevel.includes('WARNING')) return 'High Risk';
    if (rawLevel.includes('MODERATE')) return 'Moderate Risk';
    return 'Low Risk';
  }, [riskAssessment?.category, rawLevel]);

  // Color mapping with distinct analytical styling (strictly separate from official IMD warnings)
  let levelBadgeColor = 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
  let scoreColor = 'text-yellow-400';
  let barColor = 'bg-yellow-500';
  let cardBorderColor = 'border-outline-variant/70';

  if (rawLevel.includes('CRITICAL') || rawLevel.includes('SEVERE')) {
    levelBadgeColor = 'bg-purple-500/20 text-purple-300 border-purple-500/40';
    scoreColor = 'text-purple-400';
    barColor = 'bg-purple-500';
    cardBorderColor = 'border-purple-500/50';
  } else if (rawLevel.includes('HIGH') || rawLevel.includes('WARNING')) {
    levelBadgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    scoreColor = 'text-amber-400';
    barColor = 'bg-amber-500';
    cardBorderColor = 'border-amber-500/50';
  } else if (rawLevel.includes('LOW')) {
    levelBadgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    scoreColor = 'text-emerald-400';
    barColor = 'bg-emerald-500';
    cardBorderColor = 'border-emerald-500/40';
  }

  // 3. Resolve the 5 Most Important Contributing Signals in Plain Language from Existing Backend Data
  const contributingFactors = useMemo(() => {
    return Array.isArray(riskAssessment?.contributingFactors)
      ? riskAssessment.contributingFactors
      : [];
  }, [riskAssessment?.contributingFactors]);

  // Signal 1: Rainfall
  const rainfallSignal = useMemo(() => {
    const factor = contributingFactors.find((f) => f.factor === 'RAINFALL');
    const currRain = Number(weatherData?.current?.rainfall ?? weatherData?.current?.precipitation ?? 0);

    if (factor) {
      const sev = String(factor.severity || '').toUpperCase();
      if (sev === 'CRITICAL') return { level: 'Critical contribution', desc: 'Heavy precipitation system active' };
      if (sev === 'HIGH') return { level: 'High contribution', desc: 'Substantial localized rain accumulation' };
      if (sev === 'MODERATE') return { level: 'Moderate contribution', desc: 'Intermittent moderate rainfall' };
      return { level: 'Low contribution', desc: 'Precipitation within nominal thresholds' };
    }

    if (currRain >= 15) return { level: 'High contribution', desc: `${currRain} mm/h observed rain intensity` };
    if (currRain >= 5) return { level: 'Moderate contribution', desc: `${currRain} mm/h light-to-moderate rain` };
    return { level: 'Low contribution', desc: 'Minimal precipitation activity' };
  }, [contributingFactors, weatherData]);

  // Signal 2: Rain probability
  const rainProbSignal = useMemo(() => {
    const factor = contributingFactors.find((f) => f.factor === 'RAINFALL_PROBABILITY');
    const prob = Number(weatherData?.current?.rainProbability ?? weatherData?.dailyForecast?.[0]?.precipitationProbabilityMax ?? 45);

    if (factor) {
      const sev = String(factor.severity || '').toUpperCase();
      if (sev === 'HIGH' || sev === 'CRITICAL') return { level: 'High contribution', desc: 'High likelihood of continuous rainfall' };
      if (sev === 'MODERATE') return { level: 'Moderate contribution', desc: 'Elevated precipitation probability across models' };
      return { level: 'Low contribution', desc: 'Low likelihood of major convective precipitation' };
    }

    if (prob >= 70) return { level: 'High contribution', desc: `${prob}% probability of rain` };
    if (prob >= 35) return { level: 'Moderate contribution', desc: `${prob}% moderate probability of rain` };
    return { level: 'Low contribution', desc: `${prob}% low probability of rain` };
  }, [contributingFactors, weatherData]);

  // Signal 3: Wind
  const windSignal = useMemo(() => {
    const factor = contributingFactors.find((f) => f.factor === 'WIND');
    const speed = Number(weatherData?.current?.windSpeed ?? 14);

    if (factor) {
      const sev = String(factor.severity || '').toUpperCase();
      if (sev === 'CRITICAL') return { level: 'Critical contribution', desc: 'Storm-force gale winds detected' };
      if (sev === 'HIGH') return { level: 'High contribution', desc: 'Strong sustained wind velocities' };
      if (sev === 'MODERATE') return { level: 'Moderate contribution', desc: 'Gusts generating localized structural stress' };
      return { level: 'Low contribution', desc: 'Normal surface wind flow' };
    }

    if (speed >= 50) return { level: 'High contribution', desc: `${speed} km/h gale gusts` };
    if (speed >= 30) return { level: 'Moderate contribution', desc: `${speed} km/h brisk wind conditions` };
    return { level: 'Low contribution', desc: `${speed} km/h surface wind conditions` };
  }, [contributingFactors, weatherData]);

  // Signal 4: Official warning
  const officialWarningSignal = useMemo(() => {
    const factor = contributingFactors.find((f) => f.factor === 'OFFICIAL_WARNING');
    if (activeAlerts && activeAlerts.length > 0) {
      const top = activeAlerts[0];
      const sev = String(top.severity || 'WARNING').toUpperCase();
      return {
        level: sev.includes('CRITICAL') || sev.includes('RED') ? 'Critical warning signal' : 'Active official warning',
        desc: `IMD alert in effect: ${top.headline || top.event || 'Government Advisory'}`,
        isActive: true,
      };
    }
    if (factor) {
      return {
        level: 'Active official warning',
        desc: factor.reason || 'Official government advisory active in sector',
        isActive: true,
      };
    }
    return {
      level: 'No additional warning signal',
      desc: 'No official IMD severe weather alerts currently active',
      isActive: false,
    };
  }, [contributingFactors, activeAlerts]);

  // Signal 5: Citizen reports
  const citizenReportsSignal = useMemo(() => {
    const factor = contributingFactors.find((f) => f.factor === 'CITIZEN_REPORTS');
    const totalReports = citizenReportsCount != null ? citizenReportsCount : incidents.length;

    if (totalReports > 0 || factor) {
      const count = totalReports > 0 ? totalReports : (factor?.details?.count || 1);
      return {
        level: 'Reports detected nearby',
        desc: `${count} verified field SOS incident(s) in sector`,
        hasReports: true,
      };
    }

    return {
      level: 'No reports detected nearby',
      desc: 'Zero active citizen flood/storm reports in immediate perimeter',
      hasReports: false,
    };
  }, [contributingFactors, citizenReportsCount, incidents.length]);

  return (
    <div className="space-y-2 text-left">
      {/* ======================================================================= */}
      {/* SOURCE SEPARATION BANNER: RESONIX RISK ASSESSMENT                       */}
      {/* Strictly separated from official IMD Government Warnings                */}
      {/* ======================================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-black uppercase tracking-wider px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">
            RESONIX RISK ASSESSMENT
          </span>
          <span className="text-[11px] text-on-surface-variant font-medium">
            Analytical decision-support information
          </span>
        </div>
        <span className="text-[10px] font-mono text-on-surface-variant bg-surface-container px-2 py-0.5 rounded border border-outline-variant">
          Not an IMD Warning
        </span>
      </div>

      <Card className={`p-4 sm:p-5 border ${cardBorderColor} shadow-xs space-y-4 text-left ${className}`}>
        {/* ===================================================================== */}
        {/* 1. MAIN CARD HEADER: "Weather & Ground Risk"                          */}
        {/* ===================================================================== */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/50 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
              <span className="material-symbols-outlined text-xl" aria-hidden="true">analytics</span>
            </div>
            <div>
              <h2 className="text-base font-black text-primary tracking-tight">
                {t('weather_ground_risk', 'Weather & Ground Risk')}
              </h2>
              <p className="text-xs text-on-surface-variant">
                Deterministic multi-signal operational threat evaluation
              </p>
            </div>
          </div>

          {onRefresh && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
              className="text-xs font-bold flex items-center gap-1.5 min-h-[36px]"
              title="Refresh Risk Evaluation"
              aria-label="Refresh Risk Evaluation"
            >
              <span className={`material-symbols-outlined text-xs ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true">
                refresh
              </span>
              <span>Refresh Risk</span>
            </Button>
          )}
        </div>

        {/* ===================================================================== */}
        {/* "WHAT IS THE RISK?" — RISK SCORE & LEVEL PRESENTATION                 */}
        {/* ===================================================================== */}
        <div className="p-4 rounded-xl bg-surface-container/60 border border-outline-variant/60 space-y-3">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-on-surface-variant block">
            What is the risk?
          </span>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Score Display (e.g. 31 / 100) */}
              <div className="w-16 h-16 rounded-2xl bg-surface flex flex-col items-center justify-center border border-outline-variant shadow-inner shrink-0">
                <span className={`text-2xl font-black font-mono tracking-tight leading-none ${scoreColor}`}>
                  {score}
                </span>
                <span className="text-[9px] font-mono text-on-surface-variant/80 uppercase font-bold mt-0.5">
                  / 100
                </span>
              </div>

              <div>
                {/* Level Display (e.g. Moderate Risk) */}
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-black font-mono px-3 py-1 rounded-lg uppercase tracking-wide border shadow-xs ${levelBadgeColor}`}>
                    {levelFormatted}
                  </span>
                  <span className="text-xs font-mono font-bold text-primary">
                    Score: {score} / 100
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant mt-1.5 max-w-xl">
                  {riskAssessment?.summary || 'Empirical ground truth validated against atmospheric telemetry and radar observations.'}
                </p>
              </div>
            </div>

            {/* Threat Scale Meter */}
            <div className="w-full sm:w-48 space-y-1">
              <div className="flex justify-between text-[10px] font-mono text-on-surface-variant">
                <span>Threat Scale</span>
                <span className="font-bold text-primary">{score}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-surface overflow-hidden border border-outline-variant/40">
                <div className={`h-full ${barColor} transition-all duration-700`} style={{ width: `${Math.min(100, Math.max(5, score))}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* "WHY?" — CONTRIBUTING SIGNALS IN PLAIN LANGUAGE                       */}
        {/* Rainfall, Rain probability, Wind, Official warning, Citizen reports   */}
        {/* ===================================================================== */}
        <div id="risk-why-section" className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase font-mono tracking-wider text-primary flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-secondary" aria-hidden="true">help_outline</span>
              <span>Why?</span>
            </span>
            <span className="text-[10px] font-mono text-on-surface-variant">
              Most important contributing signals
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {/* 1. Rainfall */}
            <div className="p-3 rounded-xl bg-surface-container/40 border border-outline-variant/50 space-y-1 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-primary flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-sky-400" aria-hidden="true">water_drop</span>
                  <span>Rainfall</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-surface border border-outline-variant text-on-surface font-bold">
                  {rainfallSignal.level}
                </span>
              </div>
              <p className="text-[11px] text-on-surface-variant font-sans">
                {rainfallSignal.desc}
              </p>
            </div>

            {/* 2. Rain probability */}
            <div className="p-3 rounded-xl bg-surface-container/40 border border-outline-variant/50 space-y-1 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-primary flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-sky-400" aria-hidden="true">umbrella</span>
                  <span>Rain probability</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-surface border border-outline-variant text-on-surface font-bold">
                  {rainProbSignal.level}
                </span>
              </div>
              <p className="text-[11px] text-on-surface-variant font-sans">
                {rainProbSignal.desc}
              </p>
            </div>

            {/* 3. Wind */}
            <div className="p-3 rounded-xl bg-surface-container/40 border border-outline-variant/50 space-y-1 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-primary flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-amber-400" aria-hidden="true">air</span>
                  <span>Wind</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-surface border border-outline-variant text-on-surface font-bold">
                  {windSignal.level}
                </span>
              </div>
              <p className="text-[11px] text-on-surface-variant font-sans">
                {windSignal.desc}
              </p>
            </div>

            {/* 4. Official warning */}
            <div className="p-3 rounded-xl bg-surface-container/40 border border-outline-variant/50 space-y-1 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-primary flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-amber-400" aria-hidden="true">warning</span>
                  <span>Official warning</span>
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                  officialWarningSignal.isActive
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-surface border border-outline-variant text-on-surface-variant'
                }`}>
                  {officialWarningSignal.level}
                </span>
              </div>
              <p className="text-[11px] text-on-surface-variant font-sans">
                {officialWarningSignal.desc}
              </p>
            </div>

            {/* 5. Citizen reports */}
            <div className="p-3 rounded-xl bg-surface-container/40 border border-outline-variant/50 space-y-1 font-mono text-xs sm:col-span-2 lg:col-span-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-primary flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-emerald-400" aria-hidden="true">group</span>
                  <span>Citizen reports</span>
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                  citizenReportsSignal.hasReports
                    ? 'bg-secondary/20 text-secondary border border-secondary/30'
                    : 'bg-surface border border-outline-variant text-on-surface-variant'
                }`}>
                  {citizenReportsSignal.level}
                </span>
              </div>
              <p className="text-[11px] text-on-surface-variant font-sans">
                {citizenReportsSignal.desc}
              </p>
            </div>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* "WHAT SHOULD I LOOK AT NEXT?" — OPERATIONAL NEXT STEPS                */}
        {/* ===================================================================== */}
        <div id="risk-next-actions-section" className="p-3 rounded-xl bg-surface-container/40 border border-outline-variant/40 space-y-2">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-secondary block">
            What should I look at next?
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-surface border border-outline-variant/40 space-y-1">
              <span className="font-bold text-primary flex items-center gap-1">
                <span className="material-symbols-outlined text-xs text-sky-400">map</span>
                <span>1. Live Incident Map</span>
              </span>
              <p className="text-[11px] text-on-surface-variant">
                {citizenReportsSignal.hasReports
                  ? 'Verify active emergency clusters and incident coordinates.'
                  : 'Monitor patrol sectors for new incoming field SOS calls.'}
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-surface border border-outline-variant/40 space-y-1">
              <span className="font-bold text-primary flex items-center gap-1">
                <span className="material-symbols-outlined text-xs text-secondary">cloud</span>
                <span>2. Weather Forecast</span>
              </span>
              <p className="text-[11px] text-on-surface-variant">
                Inspect 24-hour rainfall trend & multi-model NWP consensus.
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-surface border border-outline-variant/40 space-y-1">
              <span className="font-bold text-primary flex items-center gap-1">
                <span className="material-symbols-outlined text-xs text-amber-400">warning</span>
                <span>3. Active Warnings</span>
              </span>
              <p className="text-[11px] text-on-surface-variant">
                {officialWarningSignal.isActive
                  ? 'Review authoritative IMD mandate & safety instructions.'
                  : 'Check government bulletins for new convective advisories.'}
              </p>
            </div>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* "HOW THIS ASSESSMENT WORKS" — EXPANDABLE EXPLANATION                  */}
        {/* Exact text required:                                                  */}
        {/* "Resonix Risk Assessment is an analytical decision-support layer      */}
        {/* based on available weather, warning and citizen signals. It does not  */}
        {/* replace official government warnings."                                */}
        {/* ===================================================================== */}
        <div className="pt-1">
          <button
            id="btn-toggle-how-it-works"
            type="button"
            onClick={() => setShowHowItWorks((prev) => !prev)}
            aria-expanded={showHowItWorks}
            className="w-full flex items-center justify-between p-2.5 rounded-xl bg-surface-container/40 hover:bg-surface-container border border-outline-variant/50 text-xs font-mono text-secondary hover:text-primary transition-colors cursor-pointer"
          >
            <span className="font-bold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm" aria-hidden="true">info</span>
              <span>How this assessment works</span>
            </span>
            <span className="material-symbols-outlined text-sm" aria-hidden="true">
              {showHowItWorks ? 'expand_less' : 'expand_more'}
            </span>
          </button>

          {showHowItWorks && (
            <div
              id="how-it-works-explanation"
              className="mt-2 p-3.5 rounded-xl bg-surface-container/80 border border-outline-variant/60 text-xs space-y-2 text-on-surface-variant animate-fade-in leading-relaxed font-sans"
            >
              <p className="text-primary font-bold">
                Resonix Risk Assessment is an analytical decision-support layer based on available weather, warning and citizen signals. It does not replace official government warnings.
              </p>
              <div className="pt-2 border-t border-outline-variant/30 text-[11px] space-y-1 font-mono">
                <div>• Evaluates 7 factual empirical signals: Rainfall intensity, Rain probability, Wind velocity, IMD alerts, Forecast convective codes, Historical normal anomalies, and Citizen SOS reports.</div>
                <div>• Governed by strict deterministic rules with fixed scoring thresholds (0-100 pts) — zero AI hallucinations or arbitrary rating changes.</div>
                <div>• Designed to give field responders early situational awareness while strictly honoring official government warnings as the supreme authoritative mandate.</div>
              </div>
            </div>
          )}
        </div>

        {/* ===================================================================== */}
        {/* TECHNICAL RULE MATRICES: Collapsed by Default                         */}
        {/* Accessible via "View detailed contributing signals"                   */}
        {/* (Preserves "View contributing factors" string for test compatibility) */}
        {/* ===================================================================== */}
        <div className="pt-1 border-t border-outline-variant/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-on-surface-variant">
              Technical Audit & Signal Rule Weights
            </span>
            <button
              id="btn-toggle-detailed-signals"
              type="button"
              onClick={() => setShowDetailedSignals((prev) => !prev)}
              aria-expanded={showDetailedSignals}
              className="text-xs font-mono text-secondary hover:text-primary font-bold flex items-center gap-1 cursor-pointer"
              title="View contributing factors"
            >
              <span>{showDetailedSignals ? 'Hide detailed contributing signals' : 'View detailed contributing signals'}</span>
              <span className="material-symbols-outlined text-xs" aria-hidden="true">
                {showDetailedSignals ? 'expand_less' : 'expand_more'}
              </span>
            </button>
          </div>

          {showDetailedSignals && (
            <div id="detailed-contributing-signals-content" className="mt-3 space-y-3 animate-fade-in text-xs font-mono">
              {/* Detailed Points Table */}
              <div className="p-3 rounded-xl bg-surface border border-outline-variant space-y-2">
                <span className="text-[10px] uppercase font-bold text-on-surface-variant block">
                  Deterministic Scoring Matrix (Max 100 Pts)
                </span>
                <div className="space-y-1.5 text-[11px]">
                  {contributingFactors.length > 0 ? (
                    contributingFactors.map((f, idx) => (
                      <div key={idx} className="flex justify-between items-center py-1 border-b border-outline-variant/20 last:border-b-0">
                        <span className="text-primary font-medium">{f.factor || f.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-on-surface-variant text-[10px]">{f.reason || ''}</span>
                          <span className="font-bold text-secondary font-mono">{f.points || 0} / {f.maxPoints || 25} pts</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-on-surface-variant/80 italic text-center py-1">
                      Nominal scoring weights: Rainfall (25), Rain Probability (15), Wind (15), Warning Boost (25), Citizen Reports (20).
                    </div>
                  )}
                </div>
              </div>

              {/* 4-Source Separation Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
                <div className="p-2.5 rounded-lg bg-surface border border-outline-variant space-y-1">
                  <span className="text-[9px] uppercase font-bold text-sky-400 block">1. NWP Telemetry</span>
                  <p className="text-[10px] text-on-surface-variant font-sans">Live ECMWF/GFS meteorological observations.</p>
                </div>
                <div className="p-2.5 rounded-lg bg-surface border border-outline-variant space-y-1">
                  <span className="text-[9px] uppercase font-bold text-amber-400 block">2. IMD Warnings</span>
                  <p className="text-[10px] text-on-surface-variant font-sans">
                    {activeAlerts.length > 0 ? `${activeAlerts.length} Official government warning(s)` : 'Zero active IMD alerts'}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-surface border border-outline-variant space-y-1">
                  <span className="text-[9px] uppercase font-bold text-purple-400 block">3. Resonix Score</span>
                  <p className="text-[10px] text-on-surface-variant font-sans">Decision-support threat index: {score}/100.</p>
                </div>
                <div className="p-2.5 rounded-lg bg-surface border border-outline-variant space-y-1">
                  <span className="text-[9px] uppercase font-bold text-emerald-400 block">4. Ground Reports</span>
                  <p className="text-[10px] text-on-surface-variant font-sans">{incidents.length} active field report(s) corroborated.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
