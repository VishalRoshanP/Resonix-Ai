import Card from '../components/ui/Card';
import StatusChip from '../components/ui/StatusChip';
import DataTable from '../components/data/DataTable';
import Button from '../components/ui/Button';

export default function ResponderCitizensPage() {
  const columns = [
    { key: 'name', label: 'Citizen Name', render: (val, row) => <div><p className="font-bold text-primary">{val}</p><p className="text-xs text-on-surface-variant">{row.mode}</p></div> },
    { key: 'location', label: 'Last Reported Location' },
    { key: 'request', label: 'Emergency Request' },
    { key: 'status', label: 'Dispatch Status', render: (val) => <StatusChip label={val} variant={val === 'Active SOS' ? 'critical' : 'resolved'} dot /> },
    { key: 'time', label: 'Time' },
  ];

  const data = [
    { id: 1, name: 'Alex Johnson', mode: 'Registered Citizen', location: 'Sector 7 (37.7749, -122.4194)', request: 'Flash Flood Rescue', status: 'Active SOS', time: '12m ago' },
    { id: 2, name: 'Guest Citizen #4102', mode: 'Guest Mode', location: 'Sector 5 Perimeter', request: 'Medical First Aid', status: 'Acknowledged', time: '45m ago' },
    { id: 3, name: 'Maria Chen', mode: 'Registered Citizen', location: 'Sector 4', request: 'Structural Inspection Voice Report', status: 'Acknowledged', time: '2h ago' },
  ];

  return (
    <div className="space-y-6 text-left">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-headline-lg font-bold text-primary">Citizen Emergency Requests</h1>
          <p className="text-body-md text-on-surface-variant mt-0.5">Live emergency packets received from citizen portal</p>
        </div>
        <Button variant="secondary" icon="download">Export Emergency Logs</Button>
      </div>

      <Card className="p-0">
        <DataTable columns={columns} data={data} />
      </Card>
    </div>
  );
}
