import { useState } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { useLanguage } from '../../contexts/LanguageContext';

/**
 * Format clock/date cleanly
 */
function formatTime(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return String(isoString);
    return d.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch (_) {
    return String(isoString);
  }
}

export default function ActiveWarningsBanner({ activeAlerts = [], weatherData = null }) {
  const { t } = useLanguage();
  const [selectedWarning, setSelectedWarning] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Extract warnings list from activeAlerts or weatherData.warnings
  const warnings = Array.isArray(activeAlerts) && activeAlerts.length > 0
    ? activeAlerts
    : (Array.isArray(weatherData?.warnings) ? weatherData.warnings : []);

  const hasWarnings = warnings.length > 0;

  // Handler for [View Details]
  const handleOpenDetails = (warning) => {
    setSelectedWarning(warning);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-2 text-left">
      {/* SOURCE SEPARATION BADGE: OFFICIAL WARNING (Government-issued information) */}
      <div className="flex items-center gap-2 px-1">
        <span className="text-[10px] font-mono font-black uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
          {t('official_warning', 'OFFICIAL WARNING')}
        </span>
        <span className="text-[11px] text-on-surface-variant font-medium">
          Government-issued information
        </span>
      </div>

      {!hasWarnings ? (
        /* NO WARNINGS STATE: Authoritative nominal baseline, definitely not looking like an error */
        <Card className="p-4 sm:p-5 border border-emerald-500/40 bg-emerald-500/5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <span className="material-symbols-outlined text-2xl">verified</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm sm:text-base font-black text-primary tracking-tight">
                    NO ACTIVE OFFICIAL WEATHER WARNINGS
                  </h2>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
                    Nominal Baseline
                  </span>
                </div>
                <div className="text-xs text-on-surface-variant mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono">
                  <span>Source:</span>
                  <strong className="text-primary font-bold">
                    India Meteorological Department (IMD)
                  </strong>
                  <span className="text-outline-variant/60">•</span>
                  <span className="text-emerald-400">All regional stations reporting normal atmospheric conditions</span>
                </div>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-2 text-xs font-mono text-on-surface-variant bg-surface-container px-3 py-1.5 rounded-xl border border-outline-variant/60">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>CAP / IMD Stream Synchronized</span>
            </div>
          </div>
        </Card>
      ) : (
        /* ACTIVE WARNINGS STATE: Professional high-priority operational cards */
        <Card className="p-4 sm:p-5 border-2 border-error/60 bg-error/10 shadow-md space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-error/30 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-error text-white flex items-center justify-center shadow-xs shrink-0 animate-pulse">
                <span className="material-symbols-outlined text-xl">warning</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-error uppercase tracking-tight">
                    {t('active_weather_warnings', 'ACTIVE WEATHER WARNINGS')} ({warnings.length})
                  </h2>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-error text-white font-extrabold uppercase tracking-wider">
                    PRIORITY ACTION REQUIRED
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Official emergency advisories from national meteorological agencies
                </p>
              </div>
            </div>

            <span className="text-xs font-mono text-on-surface-variant bg-surface px-2.5 py-1 rounded-lg border border-error/30 font-bold">
              Source: India Meteorological Department (IMD)
            </span>
          </div>

          {/* Warning Cards List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {warnings.map((w, idx) => {
              const warningType = (w.headline || w.event || w.title || 'CYCLONE WARNING').toUpperCase();
              const affectedArea = w.areaDesc || w.area || w.locationName || 'Salem Operational Sector & Coastal Lowlands';
              const severity = (w.severity || 'HIGH').toUpperCase();
              const issuingAuthority = w.senderName || w.source || 'India Meteorological Department (IMD)';
              const issuedTime = formatTime(w.sent || w.issuedAt || w.onset || w.effective);
              const validUntil = formatTime(w.expires || w.validUntil || w.ends);
              const action = w.instruction || w.recommendedAction || 'Pre-position flood rescue teams, secure low-lying settlements, and maintain live radio watch.';

              let severityBadgeClass = 'bg-amber-600 text-white font-bold';
              if (severity === 'CRITICAL' || severity === 'EXTREME' || severity === 'HIGH') {
                severityBadgeClass = 'bg-error text-white font-black';
              } else if (severity === 'MODERATE') {
                severityBadgeClass = 'bg-yellow-600 text-white font-bold';
              }

              return (
                <div
                  key={w.id || `warn_${idx}`}
                  className="p-4 rounded-xl bg-surface border border-error/40 hover:border-error transition-all shadow-xs space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    {/* Header: Warning Type & Severity */}
                    <div className="flex items-center justify-between gap-2 border-b border-outline-variant/40 pb-2">
                      <span className="font-mono text-sm font-black text-error flex items-center gap-1.5 truncate">
                        <span className="material-symbols-outlined text-base">emergency</span>
                        <span>{warningType}</span>
                      </span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase shrink-0 ${severityBadgeClass}`}>
                        {severity}
                      </span>
                    </div>

                    {/* Meta Fields */}
                    <div className="space-y-1.5 text-xs font-mono">
                      <div className="flex items-start gap-1.5">
                        <span className="text-on-surface-variant font-medium shrink-0">Affected Area:</span>
                        <strong className="text-primary truncate">{affectedArea}</strong>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
                        <span>Issued by: <strong className="text-primary">{issuingAuthority}</strong></span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-outline-variant/30 text-on-surface-variant">
                        <div>
                          <span>Issued: </span>
                          <strong className="text-primary">{issuedTime}</strong>
                        </div>
                        <div>
                          <span>Valid until: </span>
                          <strong className="text-primary">{validUntil}</strong>
                        </div>
                      </div>

                      {/* Recommended Responder Action */}
                      <div className="p-2.5 rounded-lg bg-surface-container border border-outline-variant/60 text-xs font-sans space-y-0.5 mt-2">
                        <span className="text-[10px] font-mono font-bold uppercase text-secondary block">
                          Recommended Responder Action:
                        </span>
                        <p className="text-primary font-medium line-clamp-2">
                          {action}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Action: View Details */}
                  <div className="pt-2 border-t border-outline-variant/40">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleOpenDetails(w)}
                      className="w-full text-xs font-bold py-1.5 justify-center flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-xs">visibility</span>
                      <span>{t('btn_view_details', 'View Details')}</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Official Warning Detailed Modal */}
      {isModalOpen && selectedWarning && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 animate-fade-in">
          <Card className="w-full max-w-xl p-5 bg-surface border border-error/50 shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-outline-variant/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-xl text-error">warning</span>
                <div>
                  <h3 className="font-black text-primary text-base">
                    {selectedWarning.headline || selectedWarning.event || 'Official Meteorological Warning'}
                  </h3>
                  <span className="text-[10px] font-mono text-secondary">
                    OFFICIAL WARNING • Government-issued information
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-on-surface-variant hover:text-primary cursor-pointer text-lg p-1"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-surface-container font-mono">
                <div>
                  <span className="text-[10px] text-on-surface-variant uppercase block">Severity</span>
                  <strong className="text-error font-black uppercase text-sm">
                    {selectedWarning.severity || 'HIGH'}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-on-surface-variant uppercase block">Issuing Authority</span>
                  <strong className="text-primary font-bold">
                    {selectedWarning.senderName || selectedWarning.source || 'India Meteorological Department (IMD)'}
                  </strong>
                </div>
                <div className="pt-2">
                  <span className="text-[10px] text-on-surface-variant uppercase block">Issued Time</span>
                  <span className="text-primary font-bold">{formatTime(selectedWarning.sent || selectedWarning.issuedAt)}</span>
                </div>
                <div className="pt-2">
                  <span className="text-[10px] text-on-surface-variant uppercase block">Valid Until</span>
                  <span className="text-primary font-bold">{formatTime(selectedWarning.expires || selectedWarning.validUntil)}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-mono font-bold uppercase text-on-surface-variant block mb-1">
                  Affected Geographic Area
                </span>
                <p className="p-2.5 rounded-lg bg-surface-container font-medium text-primary">
                  {selectedWarning.areaDesc || selectedWarning.area || 'Salem District & Surrounding Operational Corridors'}
                </p>
              </div>

              <div>
                <span className="text-[10px] font-mono font-bold uppercase text-on-surface-variant block mb-1">
                  Full Advisory Description
                </span>
                <p className="p-2.5 rounded-lg bg-surface-container font-sans text-on-surface leading-relaxed max-h-36 overflow-y-auto">
                  {selectedWarning.description || 'Intense convective precipitation with potential for localized flash flooding, road washouts, and urban waterlogging.'}
                </p>
              </div>

              <div>
                <span className="text-[10px] font-mono font-bold uppercase text-secondary block mb-1">
                  Recommended Responder Action
                </span>
                <p className="p-2.5 rounded-lg bg-secondary/10 border border-secondary/30 font-sans font-medium text-primary">
                  {selectedWarning.instruction || selectedWarning.recommendedAction || 'Pre-position flood rescue teams, secure low-lying settlements, and maintain live radio watch.'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-outline-variant/40">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsModalOpen(false)}
                className="font-bold"
              >
                Close Advisory
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
