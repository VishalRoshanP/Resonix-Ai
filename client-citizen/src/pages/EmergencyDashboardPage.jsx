import AIStatusCard from '../components/cards/AIStatusCard';
import AlertCard from '../components/cards/AlertCard';
import StatCard from '../components/cards/StatCard';
import Timeline from '../components/data/Timeline';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

const timelineItems = [
  { type: 'check', title: 'Packet Received: Sector 4', description: 'Sensor data logged. Temperature nominal.', time: 'Now' },
  { type: 'sync', title: 'Relay Transmit: Node Alpha', description: 'Broadcasting evacuation protocols to mesh network.', time: '-2m' },
  { type: 'mic', title: 'Voice Command Processed', description: '"Gemma, analyze structural integrity of Bridge 9."', time: '-15m' },
  { type: 'check', title: 'System Boot (Offline Mode)', description: 'Mainframe disconnected. Local reasoning engaged.', time: '-2h' },
];

export default function EmergencyDashboardPage() {
  return (
    <div className="space-y-6">
      {/* Status Row & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* AI Status Card */}
        <div className="lg:col-span-8 flex flex-col">
          <AIStatusCard className="h-full" />
        </div>

        {/* Voice Relay Trigger Area */}
        <div className="lg:col-span-4 flex flex-col">
          <Card className="flex flex-col items-center justify-center text-center h-full p-6">
            <div className="relative mb-5">
              <button
                title="Voice Command"
                className="w-18 h-18 bg-primary text-white rounded-full flex items-center justify-center shadow-ambient hover:bg-tertiary active:scale-95 transition-all z-10 relative cursor-pointer"
              >
                <span className="material-symbols-outlined text-3xl">mic</span>
              </button>
              {/* Decorative waveform */}
              <div className="absolute inset-0 -m-6 flex items-center justify-center opacity-25 pointer-events-none">
                {[8, 12, 6, 16, 10].map((h, i) => (
                  <div key={i} className="w-1 bg-secondary mx-[3px] rounded-full" style={{ height: `${h * 2.2}px` }} />
                ))}
              </div>
            </div>
            <h4 className="text-base font-bold text-primary mb-1">One Voice Command</h4>
            <p className="text-xs text-on-surface-variant mb-4 leading-relaxed max-w-xs">
              Tap to initiate AI reasoning flow or broadcast to relay network.
            </p>
            <Button variant="secondary" size="full" icon="auto_awesome">
              Incident Analysis
            </Button>
          </Card>
        </div>
      </div>

      {/* Main Grid: Alerts & Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Emergency Alerts */}
        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-xl font-bold text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-2xl">warning</span>
            Active Incidents
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AlertCard
              title="Seismic Activity Detected"
              description="Magnitude 6.2 reported near Sector 7. Infrastructure integrity at risk. Evacuation protocols recommended."
              severity="critical"
              timeLabel="T-Minus 02:14"
            />
            <AlertCard
              title="Flood Relay Active"
              description="River basin sensors indicate rapid rise. Relay network shifting power to higher elevation nodes."
              severity="warning"
              timeLabel="- 14 mins"
            />
          </div>

          {/* Grid Vital Stats */}
          <div className="pt-2">
            <h3 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-xl">analytics</span>
              Grid Vital Stats
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard
                icon="bolt"
                label="Power Reserve"
                value="84%"
                sparkline
                progress={84}
                progressVariant="primary"
              />
              <StatCard
                icon="wifi"
                label="Bandwidth"
                value="4.2 Gbps"
                sparkline
                progress={60}
                progressVariant="secondary"
              />
              <StatCard
                icon="groups"
                label="Active Personnel"
                value="142"
                subtitle="pulse"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Relay Timeline */}
        <div className="flex flex-col">
          <Timeline items={timelineItems} />
        </div>
      </div>
    </div>
  );
}
