import Card from '../components/ui/Card';
import StatusChip from '../components/ui/StatusChip';
import DataTable from '../components/data/DataTable';
import Button from '../components/ui/Button';
import StatCard from '../components/cards/StatCard';
import SignalBars from '../components/ui/SignalBars';

export default function PersonnelPage() {
  const columns = [
    { key: 'name', label: 'Name', render: (val, row) => <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-full bg-surface-variant flex items-center justify-center"><span className="material-symbols-outlined text-[16px] text-on-surface-variant">person</span></div><div><p className="font-semibold text-sm">{val}</p><p className="text-xs text-on-surface-variant">{row.role}</p></div></div> },
    { key: 'sector', label: 'Sector' },
    { key: 'heartRate', label: 'Heart Rate', render: (val) => val ? <span className="text-mono-data flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />{val} BPM</span> : <span className="text-on-surface-variant text-xs">—</span> },
    { key: 'signal', label: 'Signal', render: (val) => <SignalBars strength={val} /> },
    { key: 'status', label: 'Status', render: (val) => <StatusChip label={val} variant={val === 'active' ? 'active' : val === 'in-transit' ? 'warning' : 'offline'} dot /> },
    { key: 'lastCheckIn', label: 'Last Check-in' },
  ];
  const data = [
    { id: 1, name: 'Sgt. Maria Chen', role: 'Field Commander', sector: 'Sector 4', heartRate: 82, signal: 5, status: 'active', lastCheckIn: '2m ago' },
    { id: 2, name: 'Lt. James Walker', role: 'Medic Lead', sector: 'Sector 7', heartRate: 91, signal: 4, status: 'active', lastCheckIn: '5m ago' },
    { id: 3, name: 'Cpl. Aisha Patel', role: 'Comms Specialist', sector: 'En route S7', heartRate: 76, signal: 3, status: 'in-transit', lastCheckIn: '8m ago' },
    { id: 4, name: 'Pvt. Derek Yamamoto', role: 'Search & Rescue', sector: 'Sector 2', heartRate: null, signal: 0, status: 'offline', lastCheckIn: '45m ago' },
  ];
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-headline-lg font-bold text-primary">Personnel Operations</h1>
        <Button variant="primary" icon="person_add">Add Personnel</Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon="groups" label="Total Active" value="142" subtitle="pulse" />
        <StatCard icon="transfer_within_a_station" label="In Transit" value="12" />
        <StatCard icon="wifi_off" label="Offline" value="3" />
        <StatCard icon="local_hospital" label="Medical" value="8" subtitle="units deployed" />
      </div>
      <Card><DataTable columns={columns} data={data} /></Card>
    </div>
  );
}
