import Card from '../components/ui/Card';
import StatCard from '../components/cards/StatCard';

export default function ResponderAnalyticsPage() {
  return (
    <div className="space-y-6 text-left">
      <div>
        <h1 className="text-headline-lg font-bold text-primary">Command Analytics</h1>
        <p className="text-body-md text-on-surface-variant mt-0.5">Response metrics, dispatch latency & predictive models</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon="speed" label="Avg Response Time" value="4.2 min" sparkline />
        <StatCard icon="schedule" label="ETA Accuracy" value="96.8%" progress={96} />
        <StatCard icon="hub" label="Mesh Packet Loss" value="0.02%" progress={2} progressVariant="secondary" />
        <StatCard icon="psychology" label="Model Confidence" value="N/A" progress={0} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-5">
          <h3 className="text-body-lg font-bold text-primary mb-3">Response Velocity by Sector</h3>
          <div className="space-y-3">
            {[
              { sector: 'Sector 4 (Flood Basin)', time: '3.8 min', status: 'optimal' },
              { sector: 'Sector 7 (Seismic Epicenter)', time: '5.1 min', status: 'optimal' },
              { sector: 'Sector 2 (Relay Degraded)', time: '8.4 min', status: 'warning' },
            ].map((s, i) => (
              <div key={i} className="flex justify-between items-center text-sm border-b border-outline-variant/40 pb-2">
                <span className="text-on-surface">{s.sector}</span>
                <span className="font-mono font-bold text-primary">{s.time}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-body-lg font-bold text-primary mb-3">Gemma 4 Inference Latency</h3>
          <div className="space-y-3">
            {[
              { task: 'Voice Command Audio Transcription', time: '14ms', mode: 'Local INT4' },
              { task: 'Seismic Triage Rationale Generation', time: '28ms', mode: 'Local INT4' },
              { task: 'Mesh Packet Reconstruction', time: '6ms', mode: 'C++ Engine' },
            ].map((t, i) => (
              <div key={i} className="flex justify-between items-center text-sm border-b border-outline-variant/40 pb-2">
                <span className="text-on-surface">{t.task}</span>
                <span className="font-mono font-bold text-secondary">{t.time}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
