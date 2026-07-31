import Card from '../components/ui/Card';
import Timeline from '../components/data/Timeline';
import Button from '../components/ui/Button';

export default function ResponderAuditLogsPage() {
  const auditLogs = [
    { type: 'check', title: 'User Login: Commander Reyes', description: 'Authenticated via JWT from 192.168.1.45 (Role: Administrator)', time: '14:22:04' },
    { type: 'warning', title: 'Incident Override: INC-901', description: 'Severity elevated to Critical by Coordinator Chen.', time: '14:18:12' },
    { type: 'sync', title: 'Gemma 4 Rationale Synchronized', description: 'Model inference weights verified with mesh node 14.', time: '14:02:50' },
    { type: 'check', title: 'Resource Dispatch Approved', description: 'Alpha Squad Command assigned to Sector 7 Bridge 9.', time: '13:45:19' },
  ];

  return (
    <div className="space-y-6 text-left">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-headline-lg font-bold text-primary">System Audit Logs</h1>
          <p className="text-body-md text-on-surface-variant mt-0.5">Immutable security event history & dispatch action tracking</p>
        </div>
        <Button variant="secondary" icon="download">Export Audit Trail</Button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Timeline items={auditLogs} title="Security & Dispatch Audit Stream" />
      </div>
    </div>
  );
}
