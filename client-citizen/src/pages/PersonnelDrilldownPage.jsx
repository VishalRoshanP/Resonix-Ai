import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Timeline from '../components/data/Timeline';

export default function PersonnelDrilldownPage() {
  const navigate = useNavigate();
  const activityLog = [
    { type: 'check', title: 'Check-in: Sector 4 Perimeter', description: 'All clear. Structural assessment complete.', time: '2m ago' },
    { type: 'sync', title: 'Data Sync via Mesh Relay', description: 'Biometric data transmitted to command.', time: '5m ago' },
    { type: 'mic', title: 'Voice Report Filed', description: '"Bridge 9 east span shows stress fractures at joint 4C."', time: '12m ago' },
    { type: 'check', title: 'Deployed to Sector 4', description: 'En route from base camp. ETA was 8 minutes.', time: '35m ago' },
  ];
  return (
    <div className="space-y-6">
      <Button variant="ghost" icon="arrow_back" onClick={() => navigate('/personnel')}>
        Back to Personnel
      </Button>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 p-6 text-center">
          <div className="w-20 h-20 rounded-full bg-surface-variant border-2 border-outline-variant mx-auto mb-4 flex items-center justify-center">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant">person</span>
          </div>
          <h2 className="text-headline-md font-bold text-primary">Sgt. Maria Chen</h2>
          <p className="text-body-md text-on-surface-variant">Field Commander</p>
          <div className="mt-4 space-y-2 text-left">
            <div className="flex justify-between text-sm border-b border-outline-variant/50 pb-2"><span className="text-on-surface-variant">Sector</span><span className="font-semibold text-primary">Sector 4</span></div>
            <div className="flex justify-between text-sm border-b border-outline-variant/50 pb-2"><span className="text-on-surface-variant">Status</span><span className="font-semibold text-success">Active</span></div>
            <div className="flex justify-between text-sm border-b border-outline-variant/50 pb-2"><span className="text-on-surface-variant">Heart Rate</span><span className="font-mono font-semibold text-primary">82 BPM</span></div>
            <div className="flex justify-between text-sm"><span className="text-on-surface-variant">Signal</span><span className="font-semibold text-primary">5/5</span></div>
          </div>
          <Button variant="urgent" size="full" icon="sos" className="mt-6">Emergency Contact</Button>
        </Card>
        <div className="md:col-span-2">
          <Timeline items={activityLog} title="Activity Log" />
        </div>
      </div>
    </div>
  );
}
