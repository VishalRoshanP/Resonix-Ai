import React from 'react';
import Card from '../ui/Card';

/**
 * SituationOverviewCards
 * Clean 4-card operational overview designed for 5-10 second situational awareness.
 * 
 * Hierarchy:
 * 1. Active Warnings
 * 2. Critical Incidents
 * 3. High-Risk Areas
 * 4. Citizen Reports
 */
export default function SituationOverviewCards({
  activeWarningsCount,
  criticalIncidentsCount,
  highRiskAreasCount,
  citizenReportsCount,
  activeAlerts = [],
  incidents = [],
  clusters = [],
  riskAssessment = null,
  dashboardSummary = null,
  onCardClick,
  className = '',
}) {
  const finalWarningsCount = activeWarningsCount != null
    ? activeWarningsCount
    : (Array.isArray(activeAlerts) ? activeAlerts.length : 0);

  const finalCriticalCount = criticalIncidentsCount != null
    ? criticalIncidentsCount
    : (Array.isArray(incidents) ? incidents.filter((i) => {
        const sev = String(i.priority || i.severity || '').toUpperCase();
        return sev === 'CRITICAL' || sev === 'HIGH' || sev.includes('LEVEL_5') || sev.includes('LEVEL_4');
      }).length : 0);

  const finalHighRiskAreasCount = highRiskAreasCount != null
    ? highRiskAreasCount
    : (Array.isArray(clusters) ? clusters.length : 0);

  const finalReportsCount = citizenReportsCount != null
    ? citizenReportsCount
    : (Array.isArray(incidents) ? incidents.length : 0);

  const cards = [
    {
      id: 'warnings',
      title: 'ACTIVE WARNINGS',
      count: finalWarningsCount,
      description: 'Government weather warnings',
      status: finalWarningsCount > 0 ? 'ACTIVE ADVISORY' : 'ALL CLEAR',
      statusColor: finalWarningsCount > 0 ? 'bg-error text-white font-bold' : 'bg-emerald-600 text-white font-bold',
      countColor: finalWarningsCount > 0 ? 'text-error' : 'text-emerald-500',
      borderColor: finalWarningsCount > 0 ? 'border-error/50' : 'border-outline-variant/60',
      icon: 'campaign',
    },
    {
      id: 'critical',
      title: 'CRITICAL INCIDENTS',
      count: finalCriticalCount,
      description: 'Require responder attention',
      status: finalCriticalCount > 0 ? 'ATTENTION REQUIRED' : 'STABLE',
      statusColor: finalCriticalCount > 0 ? 'bg-red-700 text-white font-bold' : 'bg-surface-container text-on-surface-variant font-bold',
      countColor: finalCriticalCount > 0 ? 'text-red-500' : 'text-primary',
      borderColor: finalCriticalCount > 0 ? 'border-red-500/50' : 'border-outline-variant/60',
      icon: 'emergency',
    },
    {
      id: 'risk_areas',
      title: 'HIGH-RISK AREAS',
      count: finalHighRiskAreasCount,
      description: 'Based on current signals',
      status: finalHighRiskAreasCount > 0 ? 'MONITORING' : 'LOW RISK',
      statusColor: finalHighRiskAreasCount > 0 ? 'bg-amber-600 text-white font-bold' : 'bg-surface-container text-on-surface-variant font-bold',
      countColor: finalHighRiskAreasCount > 0 ? 'text-amber-500' : 'text-primary',
      borderColor: finalHighRiskAreasCount > 0 ? 'border-amber-500/50' : 'border-outline-variant/60',
      icon: 'hub',
    },
    {
      id: 'citizen_reports',
      title: 'CITIZEN REPORTS',
      count: finalReportsCount,
      description: 'Recent reports received',
      status: 'LIVE INGESTION',
      statusColor: 'bg-secondary/20 text-secondary border border-secondary/40 font-bold',
      countColor: 'text-secondary',
      borderColor: 'border-outline-variant/60',
      icon: 'record_voice_over',
    },
  ];

  return (
    <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 ${className}`}>
      {cards.map((c) => (
        <Card
          key={c.id}
          onClick={() => onCardClick && onCardClick(c.id)}
          className={`p-4 sm:p-5 border ${c.borderColor} bg-surface shadow-xs flex flex-col justify-between min-h-[120px] transition-all hover:border-secondary/70 ${onCardClick ? 'cursor-pointer' : ''}`}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-[10px] sm:text-[11px] font-mono font-black uppercase tracking-wider text-on-surface-variant">
              {c.title}
            </span>
            <span className={`text-[9px] font-mono px-2 py-0.5 rounded uppercase shrink-0 ${c.statusColor}`}>
              {c.status}
            </span>
          </div>

          <div className="my-2">
            <span className={`text-3xl sm:text-4xl font-mono font-black tracking-tight block leading-none ${c.countColor}`}>
              {c.count}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span className="font-medium text-[11px] sm:text-xs truncate">{c.description}</span>
            <span className="material-symbols-outlined text-base opacity-40 shrink-0">{c.icon}</span>
          </div>
        </Card>
      ))}
    </div>
  );
}
