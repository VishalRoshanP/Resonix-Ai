import Card from '../components/ui/Card';
import StatusChip from '../components/ui/StatusChip';
export default function LogisticsPredictivePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-headline-lg font-bold text-primary">Predictive Deployment Modeling</h1>
      <p className="text-body-md text-on-surface-variant">AI-forecasted resource requirements</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { resource: 'Water Supply', current: '4,800L', predicted: '7,200L', delta: '+2,400L', confidence: 'N/A', timeframe: '24h' },
          { resource: 'Medical Kits', current: '120', predicted: '460', delta: '+340 kits', confidence: 'N/A', timeframe: '24h' },
          { resource: 'Fuel Reserve', current: '2,400L', predicted: '3,600L', delta: '+1,200L', confidence: 'N/A', timeframe: '24h' },
        ].map((r, i) => (
          <Card key={i} variant="ai" className="p-5">
            <h3 className="text-body-lg font-bold text-primary mb-3">{r.resource}</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm"><span className="text-on-surface-variant">Current</span><span className="font-mono font-semibold text-primary">{r.current}</span></div>
              <div className="flex justify-between text-sm"><span className="text-on-surface-variant">Predicted Need</span><span className="font-mono font-semibold text-secondary">{r.predicted}</span></div>
              <div className="flex justify-between text-sm"><span className="text-on-surface-variant">Delta</span><span className="font-mono font-bold text-error">{r.delta}</span></div>
              <div className="flex justify-between text-sm border-t border-outline-variant pt-2 mt-2"><span className="text-on-surface-variant">Confidence</span><span className="font-mono font-semibold text-secondary">{r.confidence}</span></div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
