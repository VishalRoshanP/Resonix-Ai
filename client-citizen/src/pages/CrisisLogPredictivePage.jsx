import Card from '../components/ui/Card';
import StatusChip from '../components/ui/StatusChip';
export default function CrisisLogPredictivePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-headline-lg font-bold text-primary">Predictive Incident Insights</h1>
      <p className="text-body-md text-on-surface-variant">AI-generated predictions based on historical incident patterns</p>
      <div className="space-y-4">
        {[
          { time: '+30m', event: 'River basin breach imminent', probability: '89%', severity: 'critical', recommendation: 'Complete Sector 6 evacuation. Deploy flood barriers.' },
          { time: '+2h', event: 'Aftershock probability peak', probability: '72%', severity: 'warning', recommendation: 'Keep responders clear of damaged structures. Pre-position medical.' },
          { time: '+6h', event: 'Infrastructure stabilization window', probability: '81%', severity: 'active', recommendation: 'Begin structural assessments of Bridge 9 and Grid Node cluster.' },
        ].map((item, i) => (
          <Card key={i} variant="ai" className="p-5">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-3">
                <span className="text-mono-data font-bold text-secondary text-lg">{item.time}</span>
                <StatusChip label={item.severity} variant={item.severity} />
              </div>
              <span className="text-mono-data font-bold text-primary">{item.probability}</span>
            </div>
            <h3 className="text-body-lg font-bold text-primary mb-2">{item.event}</h3>
            <p className="text-sm text-on-surface-variant border-l-2 border-secondary pl-3">{item.recommendation}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
