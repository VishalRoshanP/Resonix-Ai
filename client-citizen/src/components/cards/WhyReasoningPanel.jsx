import Card from '../ui/Card';
import StatusChip from '../ui/StatusChip';

export default function WhyReasoningPanel({
  title = 'Why Gemma 4 Recommended This Action',
  confidence = null,
  primaryReason = 'Multi-sensor telemetry indicates emergency situation in Sector 4.',
  dataSources = [
    { name: 'Sensor Telemetry', detail: 'Real-time telemetry payload', status: 'verified' },
    { name: 'Voice Relay Audio', detail: 'Citizen emergency report transcript', status: 'verified' },
  ],
  riskFactors = [
    'Emergency situation requires immediate response coordination.',
  ],
}) {
  return (
    <Card variant="ai" className="p-5 border-l-4 border-l-secondary">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-outline-variant/60">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-secondary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            psychology
          </span>
          <div>
            <h3 className="text-body-lg font-bold text-primary">{title}</h3>
            <p className="text-xs text-on-surface-variant">Gemma 4 Local Reasoning Rationale</p>
          </div>
        </div>
        <StatusChip label={confidence ? `Confidence: ${confidence}` : 'Confidence: Not Available'} variant="active" dot />
      </div>

      {/* Primary Rationale */}
      <div className="bg-surface-container/60 rounded-xl p-4 mb-4 border border-outline-variant/40">
        <p className="text-xs font-bold uppercase tracking-wider text-secondary mb-1">Primary Rationale</p>
        <p className="text-sm font-semibold text-primary leading-relaxed">{primaryReason}</p>
      </div>

      {/* Grid: Ground Truth Sources & Risk Assessment */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Data Sources */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base text-primary">analytics</span>
            Ground Truth Telemetry
          </h4>
          <div className="space-y-2">
            {dataSources.map((src, i) => (
              <div key={i} className="flex justify-between items-center bg-surface-container-lowest p-2.5 rounded-lg border border-outline-variant/40 text-xs">
                <span className="font-bold text-primary">{src.name}</span>
                <span className="text-on-surface-variant font-mono text-[11px]">{src.detail}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Assessment */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base text-error">warning</span>
            Identified Risk Factors
          </h4>
          <ul className="space-y-2">
            {riskFactors.map((risk, i) => (
              <li key={i} className="flex items-start gap-2 bg-surface-container-lowest p-2.5 rounded-lg border border-outline-variant/40 text-xs text-on-surface">
                <span className="w-1.5 h-1.5 rounded-full bg-error mt-1.5 shrink-0" />
                <span>{risk}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}
