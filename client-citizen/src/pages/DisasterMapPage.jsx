import Card from '../components/ui/Card';
import StatusChip from '../components/ui/StatusChip';
import Button from '../components/ui/Button';

export default function DisasterMapPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-headline-lg font-bold text-primary">Disaster Intelligence Map</h1>
          <p className="text-body-md text-on-surface-variant mt-1">Real-time situational awareness</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon="layers">Layers</Button>
          <Button variant="urgent" icon="my_location">Center</Button>
        </div>
      </div>

      {/* Map Placeholder Container */}
      <Card className="relative overflow-hidden h-[380px] sm:h-[460px] md:h-[520px] p-0">
        <div className="absolute inset-0 bg-surface-container-high flex items-center justify-center p-6 text-center">
          <div>
            <span className="material-symbols-outlined text-5xl sm:text-6xl text-outline-variant mb-3 block">map</span>
            <p className="text-lg sm:text-headline-md font-bold text-primary mb-2">Interactive Map View</p>
            <p className="text-xs sm:text-body-md text-on-surface-variant max-w-md mx-auto leading-relaxed">
              Geospatial intelligence layer with incident markers, responder positions, and evacuation routes.
            </p>
          </div>
        </div>

        {/* Overlay Controls */}
        <div className="absolute top-3 left-3 sm:top-4 sm:left-4 flex flex-wrap gap-1.5 sm:gap-2 z-10 max-w-[calc(100%-24px)]">
          {['Incidents', 'Responders', 'Evacuation', 'Heatmap'].map((layer) => (
            <button key={layer} className="flex items-center gap-1.5 bg-surface-container-lowest/90 backdrop-blur-sm border border-outline-variant rounded-md px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-surface-variant transition-colors cursor-pointer shadow-xs">
              <span className="w-2 h-2 rounded-full bg-secondary" />
              {layer}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 bg-surface-container-lowest/90 backdrop-blur-sm border border-outline-variant rounded-lg p-3 z-10 shadow-xs">
          <p className="text-[10px] uppercase text-on-surface-variant mb-1.5 font-extrabold tracking-wider">Legend</p>
          <div className="space-y-1">
            {[
              { color: 'bg-error', label: 'Critical Incident' },
              { color: 'bg-secondary', label: 'Warning Zone' },
              { color: 'bg-success', label: 'Safe Zone' },
              { color: 'bg-primary', label: 'Responder Unit' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${item.color}`} />
                <span className="text-[11px] font-medium text-on-surface">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Map Info Panels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-error text-[18px]">warning</span>
            <span className="text-sm font-bold text-primary">Active Incidents</span>
          </div>
          <div className="text-2xl font-bold font-mono text-primary">4</div>
          <p className="text-xs text-on-surface-variant mt-1">2 critical, 2 monitoring</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-success text-[18px]">groups</span>
            <span className="text-sm font-bold text-primary">Deployed Units</span>
          </div>
          <div className="text-2xl font-bold font-mono text-primary">23</div>
          <p className="text-xs text-on-surface-variant mt-1">142 personnel active</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-secondary text-[18px]">cell_tower</span>
            <span className="text-sm font-bold text-primary">Mesh Coverage</span>
          </div>
          <div className="text-2xl font-bold font-mono text-primary">87%</div>
          <p className="text-xs text-on-surface-variant mt-1">3 dead zones detected</p>
        </Card>
      </div>
    </div>
  );
}
