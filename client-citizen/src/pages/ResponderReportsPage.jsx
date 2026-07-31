import Card from '../components/ui/Card';
import StatusChip from '../components/ui/StatusChip';
import Button from '../components/ui/Button';

export default function ResponderReportsPage() {
  const reports = [
    { title: 'Gemma 4 Executive Situational Report', date: '2026-07-29', type: 'AI Incident Synthesis', status: 'Generated' },
    { title: 'Mesh Relay Hop Performance Log', date: '2026-07-29', type: 'Network Telemetry', status: 'Verified' },
    { title: 'Sector 7 Evacuation After-Action', date: '2026-07-28', type: 'Field Operations', status: 'Archived' },
  ];

  return (
    <div className="space-y-6 text-left">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-headline-lg font-bold text-primary">Command Center Reports</h1>
          <p className="text-body-md text-on-surface-variant mt-0.5">Automated Gemma 4 briefs & disaster logistics documentation</p>
        </div>
        <Button variant="primary" icon="auto_awesome">Generate New Brief</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {reports.map((r, i) => (
          <Card key={i} className="p-5 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex justify-between items-start mb-2">
                <StatusChip label={r.status} variant="info" />
                <span className="text-xs font-mono text-on-surface-variant">{r.date}</span>
              </div>
              <h3 className="text-body-lg font-bold text-primary">{r.title}</h3>
              <p className="text-xs text-on-surface-variant mt-1">{r.type}</p>
            </div>
            <Button variant="secondary" size="sm" icon="download">Download PDF</Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
