import Card from '../components/ui/Card';
import StatusChip from '../components/ui/StatusChip';
import DataTable from '../components/data/DataTable';
import Button from '../components/ui/Button';

export default function ResponderUsersPage() {
  const columns = [
    { key: 'name', label: 'User Name', render: (val, row) => <div><p className="font-bold text-primary">{val}</p><p className="text-xs text-on-surface-variant">{row.email}</p></div> },
    { key: 'role', label: 'Command Role', render: (val) => <StatusChip label={val} variant={val === 'Administrator' ? 'critical' : val === 'Coordinator' ? 'warning' : 'info'} dot /> },
    { key: 'organization', label: 'Organization' },
    { key: 'lastActive', label: 'Last Active' },
  ];

  const data = [
    { id: 1, name: 'Commander Reyes', email: 'reyes@resonix.gov', role: 'Administrator', organization: 'NDRF Command Center', lastActive: 'Active Now' },
    { id: 2, name: 'Sgt. Maria Chen', email: 'chen@resonix.gov', role: 'Coordinator', organization: 'Field Command S4', lastActive: '5m ago' },
    { id: 3, name: 'Lt. James Walker', email: 'walker@resonix.gov', role: 'Responder', organization: 'Medical Unit C', lastActive: '12m ago' },
  ];

  return (
    <div className="space-y-6 text-left">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-headline-lg font-bold text-primary">Command Center Users</h1>
          <p className="text-body-md text-on-surface-variant mt-0.5">Personnel accounts & role-based permissions (Responder, Coordinator, Admin)</p>
        </div>
        <Button variant="primary" icon="person_add">Invite User</Button>
      </div>

      <Card className="p-0">
        <DataTable columns={columns} data={data} />
      </Card>
    </div>
  );
}
