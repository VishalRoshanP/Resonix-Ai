import Card from '../components/ui/Card';
import StatusChip from '../components/ui/StatusChip';
import DataTable from '../components/data/DataTable';
import Button from '../components/ui/Button';

export default function ResponderOrganizationsPage() {
  const columns = [
    { key: 'name', label: 'Organization Name', render: (val) => <span className="font-bold text-primary">{val}</span> },
    { key: 'sector', label: 'Assigned Sector' },
    { key: 'activeUnits', label: 'Active Units', render: (val) => <span className="font-mono font-bold">{val} teams</span> },
    { key: 'status', label: 'Network Status', render: (val) => <StatusChip label={val} variant="active" dot /> },
  ];

  const data = [
    { id: 1, name: 'NDRF Command Battalion', sector: 'Sectors 5-8', activeUnits: 14, status: 'Active Dispatch' },
    { id: 2, name: 'Red Cross Emergency Triage', sector: 'Field Hospital B', activeUnits: 8, status: 'Active Dispatch' },
    { id: 3, name: 'Fire & Structural Rescue Corps', sector: 'Sector 4 Bridge 9', activeUnits: 6, status: 'Active Dispatch' },
  ];

  return (
    <div className="space-y-6 text-left">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-headline-lg font-bold text-primary">Organizations & Agencies</h1>
          <p className="text-body-md text-on-surface-variant mt-0.5">Participating emergency response organizations & sector assignments</p>
        </div>
        <Button variant="primary" icon="add">Add Agency</Button>
      </div>

      <Card className="p-0">
        <DataTable columns={columns} data={data} />
      </Card>
    </div>
  );
}
