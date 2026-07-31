import Card from '../components/ui/Card';
import BrandHeader from '../components/ui/BrandHeader';

export default function GemmaProcessingPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <BrandHeader description="Real-time local AI reasoning engine & background tasks" />

      <Card variant="ai" className="p-8 text-center">
        <div className="relative w-24 h-24 mx-auto mb-6">
          <div className="absolute inset-0 border-2 border-secondary rounded-full animate-pulse-ring" />
          <div className="absolute inset-0 border border-secondary/30 rounded-full animate-pulse-ring" style={{ animationDelay: '0.6s' }} />
          <div className="w-full h-full rounded-full bg-surface-container flex items-center justify-center">
            <span className="material-symbols-outlined text-secondary text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
          </div>
        </div>
        <h2 className="text-headline-md font-bold text-primary mb-1">Gemma 4 Processing Engine</h2>
        <p className="text-xs font-semibold text-secondary uppercase tracking-widest mb-4">Powered by Gemma 4</p>
        <p className="text-body-md text-on-surface-variant max-w-md mx-auto mb-6">
          Analyzing incoming sensor streams, mesh packets, and generating situational intelligence locally.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-xl mx-auto">
          <div><p className="text-label-sm uppercase text-on-surface-variant">Active Tasks</p><p className="text-lg font-bold font-mono text-primary">12</p></div>
          <div><p className="text-label-sm uppercase text-on-surface-variant">Threads</p><p className="text-lg font-bold font-mono text-primary">8 / 12</p></div>
          <div><p className="text-label-sm uppercase text-on-surface-variant">Confidence</p><p className="text-lg font-bold font-mono text-secondary">N/A</p></div>
          <div><p className="text-label-sm uppercase text-on-surface-variant">Mode</p><p className="text-lg font-bold font-mono text-primary">Local NPU</p></div>
        </div>
      </Card>
      <div className="space-y-3">
        {[
          { task: 'Seismic pattern analysis', status: 'completed', progress: 100 },
          { task: 'Flood risk model update', status: 'processing', progress: 67 },
          { task: 'Personnel deployment optimization', status: 'processing', progress: 45 },
          { task: 'Supply chain forecasting', status: 'queued', progress: 0 },
        ].map((t, i) => (
          <Card key={i} className="p-4 flex items-center gap-4">
            <span className={`material-symbols-outlined text-[20px] ${t.status === 'completed' ? 'text-success' : t.status === 'processing' ? 'text-secondary animate-spin' : 'text-outline'}`}>
              {t.status === 'completed' ? 'check_circle' : t.status === 'processing' ? 'progress_activity' : 'hourglass_empty'}
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-primary">{t.task}</p>
              <div className="w-full bg-surface-container h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${t.status === 'completed' ? 'bg-success' : 'bg-secondary'}`} style={{ width: `${t.progress}%` }} />
              </div>
            </div>
            <span className="text-mono-data text-on-surface-variant">{t.progress}%</span>
          </Card>
        ))}
      </div>
    </div>
  );
}
