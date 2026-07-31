import Card from '../components/ui/Card';
import DataTable from '../components/data/DataTable';
import StatusChip from '../components/ui/StatusChip';
import Button from '../components/ui/Button';
import StatCard from '../components/cards/StatCard';
export default function LogisticsArchivesPage() {
  const columns = [
    { key: 'type', label: 'Type' },
    { key: 'sector', label: 'Destination' },
    { key: 'status', label: 'Status', render: (val) => <StatusChip label={val} variant={val === 'delivered' ? 'active' : val === 'in-transit' ? 'warning' : 'info'} /> },
    { key: 'timestamp', label: 'Time' },
  ];
  const data = [
    { id: 1, type: 'Supply Drop', sector: 'Sector 4', status: 'delivered', timestamp: '2h ago' },
    { id: 2, type: 'Evac Transport', sector: 'Sector 7', status: 'in-transit', timestamp: '30m ago' },
    { id: 3, type: 'Medical Supply', sector: 'Field Hospital B', status: 'pending', timestamp: '15m ago' },
    { id: 4, type: 'Fuel Delivery', sector: 'Base Camp Alpha', status: 'delivered', timestamp: '4h ago' },
    { id: 5, type: 'Equipment Transfer', sector: 'Sector 2', status: 'in-transit', timestamp: '1h ago' },
  ];
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-headline-lg font-bold text-primary">Logistics Operations</h1>
        <div className="flex gap-2">
          <Button variant="secondary" icon="filter_list">Filter</Button>
          <Button variant="primary" icon="add">New Dispatch</Button>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon="local_shipping" label="Total Deployments" value="142" />
        <StatCard icon="rv_hookup" label="Active Transports" value="23" />
        <StatCard icon="check_circle" label="Delivered Today" value="89" />
        <StatCard icon="schedule" label="Avg. Delivery" value="34m" />
      </div>
      <Card><DataTable columns={columns} data={data} /></Card>
    </div>
  );
}
