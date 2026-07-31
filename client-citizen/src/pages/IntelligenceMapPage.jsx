import Card from '../components/ui/Card';
import StatusChip from '../components/ui/StatusChip';
import MapContainerPlaceholder from '../components/ui/MapContainerPlaceholder';

export default function IntelligenceMapPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-headline-lg font-bold text-primary">Intelligence Map Drill-down</h1>
      <p className="text-body-md text-on-surface-variant">Geospatial intelligence overlay with AI annotations</p>
      <MapContainerPlaceholder
        icon="travel_explore"
        title="AI-Annotated Map"
        subtitle="Incident zones with predicted impact radii"
        heightClass="h-[360px] sm:h-[420px]"
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { zone: 'Impact Zone Alpha', status: 'critical', pop: '12,400', action: 'Evacuate' },
          { zone: 'Buffer Zone Beta', status: 'warning', pop: '8,200', action: 'Monitor' },
          { zone: 'Safe Zone Gamma', status: 'active', pop: '3,100', action: 'Shelter-in-place' },
        ].map((z, i) => (
          <Card key={i} className="p-4">
            <div className="flex justify-between items-start mb-2">
              <h4 className="text-sm font-bold text-primary">{z.zone}</h4>
              <StatusChip label={z.status} variant={z.status} />
            </div>
            <p className="text-mono-data text-on-surface-variant">Pop: {z.pop}</p>
            <p className="text-xs text-secondary font-semibold mt-1">Action: {z.action}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
