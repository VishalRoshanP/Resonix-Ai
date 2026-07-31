import Card from '../components/ui/Card';
import DataTable from '../components/data/DataTable';
import StatusChip from '../components/ui/StatusChip';
export default function LogisticsDeploymentPage() {
  const columns = [
    { key: 'unit', label: 'Unit' },
    { key: 'destination', label: 'Destination' },
    { key: 'departureTime', label: 'Departure' },
    { key: 'status', label: 'Status', render: (val) => <StatusChip label={val} variant={val === 'deployed' ? 'active' : val === 'en-route' ? 'warning' : 'info'} /> },
  ];
  const data = [
    { id: 1, unit: 'Alpha Squad', destination: 'Sector 7', departureTime: '14:30', status: 'deployed' },
    { id: 2, unit: 'Medical Unit C', destination: 'Field Hospital', departureTime: '15:45', status: 'en-route' },
    { id: 3, unit: 'Engineering Team 2', destination: 'Bridge 9', departureTime: '13:20', status: 'deployed' },
    { id: 4, unit: 'Supply Convoy B', destination: 'Base Camp', departureTime: '16:00', status: 'staging' },
  ];
  return (
    <div className="space-y-6">
      <h1 className="text-headline-lg font-bold text-primary">Unit Deployment History</h1>
      <p className="text-body-md text-on-surface-variant">Historical deployment records & current assignments</p>
      <Card><DataTable columns={columns} data={data} /></Card>
    </div>
  );
}
