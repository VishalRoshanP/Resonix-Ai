import Card from '../components/ui/Card';
import StatusChip from '../components/ui/StatusChip';
import DataTable from '../components/data/DataTable';
export default function IntelligencePersonnelPage() {
  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'role', label: 'Role' },
    { key: 'sector', label: 'Sector' },
    { key: 'status', label: 'Status', render: (val) => <StatusChip label={val} variant={val === 'active' ? 'active' : val === 'in-transit' ? 'warning' : 'offline'} dot /> },
    { key: 'lastCheckIn', label: 'Last Check-in' },
  ];
  const data = [
    { id: 1, name: 'Sgt. Maria Chen', role: 'Field Commander', sector: 'Sector 4', status: 'active', lastCheckIn: '2m ago' },
    { id: 2, name: 'Lt. James Walker', role: 'Medic Lead', sector: 'Sector 7', status: 'active', lastCheckIn: '5m ago' },
    { id: 3, name: 'Cpl. Aisha Patel', role: 'Comms Specialist', sector: 'En route S7', status: 'in-transit', lastCheckIn: '8m ago' },
    { id: 4, name: 'Pvt. Derek Yamamoto', role: 'Search & Rescue', sector: 'Sector 2', status: 'offline', lastCheckIn: '45m ago' },
  ];
  return (
    <div className="space-y-6">
      <h1 className="text-headline-lg font-bold text-primary">Personnel Intelligence</h1>
      <p className="text-body-md text-on-surface-variant">Drill-down into personnel status from intelligence briefing</p>
      <Card><DataTable columns={columns} data={data} /></Card>
    </div>
  );
}
