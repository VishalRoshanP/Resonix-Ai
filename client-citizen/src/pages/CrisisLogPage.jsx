import Timeline from '../components/data/Timeline';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
export default function CrisisLogPage() {
  const logItems = [
    { type: 'warning', title: 'Seismic Event — Magnitude 6.2', description: 'Detected in Sector 7. Emergency protocols activated.', time: '14:22' },
    { type: 'sync', title: 'Evacuation Order Issued', description: 'Sectors 5-8 ordered to evacuate via Route Alpha.', time: '14:25' },
    { type: 'check', title: 'Alpha Squad Deployed', description: 'ETA 12 minutes to Sector 7 perimeter.', time: '14:28' },
    { type: 'mic', title: 'Voice Report: Bridge 9', description: 'Structural integrity at 42%. Load restrictions recommended.', time: '14:35' },
    { type: 'sync', title: 'Flood Warning Elevated', description: 'River basin sensors show rapid rise. Threshold breach predicted.', time: '14:42' },
    { type: 'check', title: 'Medical Unit C En Route', description: 'Dispatched to Field Hospital with additional IV supplies.', time: '14:50' },
    { type: 'success', title: 'Power Grid Node 14 Restored', description: 'Backup generators online. Area 14 power nominal.', time: '15:02' },
  ];
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-headline-lg font-bold text-primary">Incident Timeline</h1>
        <div className="flex gap-2">
          <Button variant="secondary" icon="filter_list">Filter</Button>
          <Button variant="secondary" icon="download">Export</Button>
        </div>
      </div>
      <Timeline items={logItems} title="Incident Timeline" />
    </div>
  );
}
