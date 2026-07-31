import Card from '../components/ui/Card';
import MapContainerPlaceholder from '../components/ui/MapContainerPlaceholder';

export default function LogisticsGeoPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-headline-lg font-bold text-primary">Geospatial Logistics</h1>
      <p className="text-body-md text-on-surface-variant">Supply routes & distribution zones</p>
      <MapContainerPlaceholder
        icon="route"
        title="Supply Route Map"
        subtitle="Active transport routes with estimated delivery times"
        heightClass="h-[380px] sm:h-[450px]"
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { route: 'Route Alpha', distance: '12.4 km', eta: '18 min', status: 'Active' },
          { route: 'Route Beta', distance: '8.7 km', eta: '12 min', status: 'Obstructed' },
          { route: 'Route Gamma', distance: '22.1 km', eta: '34 min', status: 'Clear' },
        ].map((r, i) => (
          <Card key={i} className="p-4">
            <h4 className="font-bold text-primary text-sm">{r.route}</h4>
            <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
              <div><span className="text-on-surface-variant">Distance</span><p className="text-mono-data font-semibold text-primary">{r.distance}</p></div>
              <div><span className="text-on-surface-variant">ETA</span><p className="text-mono-data font-semibold text-primary">{r.eta}</p></div>
            </div>
            <span className={`text-label-sm uppercase mt-2 block ${r.status === 'Obstructed' ? 'text-error' : 'text-success'}`}>{r.status}</span>
          </Card>
        ))}
      </div>
    </div>
  );
}
