import { useState } from 'react';
import Card from '../components/ui/Card';
import StatusChip from '../components/ui/StatusChip';
import Button from '../components/ui/Button';
import DataTable from '../components/data/DataTable';

export default function ResponderIncidentsPage() {
  const [filter, setFilter] = useState('all');

  const columns = [
    { key: 'id', label: 'ID', render: (val) => <span className="font-mono font-bold text-xs">{val}</span> },
    { key: 'title', label: 'Incident Title', render: (val, row) => <div><p className="font-bold text-primary">{val}</p><p className="text-xs text-on-surface-variant">{row.sector}</p></div> },
    { key: 'severity', label: 'Severity', render: (val) => <StatusChip label={val} variant={val === 'critical' ? 'critical' : val === 'warning' ? 'warning' : 'info'} dot /> },
    { key: 'responders', label: 'Responders', render: (val) => <span className="font-mono font-bold">{val} units</span> },
    { key: 'time', label: 'Reported' },
  ];

  const data = [
    { id: 'INC-901', title: 'Seismic Activity — Ep. 4.2km', sector: 'Sector 7', severity: 'critical', responders: 12, time: '12m ago' },
    { id: 'INC-842', title: 'River Basin Crest Breach', sector: 'Sector 5', severity: 'critical', responders: 8, time: '28m ago' },
    { id: 'INC-719', title: 'Structural Crack — Bridge 9', sector: 'Sector 4', severity: 'warning', time: '1h ago' },
    { id: 'INC-605', title: 'Relay Node 14 Disconnection', sector: 'Sector 2', severity: 'info', responders: 3, time: '3h ago' },
  ];

  const filteredData = data.filter(d => filter === 'all' || d.severity === filter);

  return (
    <div className="space-y-6 text-left">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-headline-lg font-bold text-primary">Incident Management</h1>
          <p className="text-body-md text-on-surface-variant mt-0.5">Active disaster dispatch directory & unit triage</p>
        </div>
        <Button variant="primary" icon="add">Report New Incident</Button>
      </div>

      <div className="flex gap-2 border-b border-outline-variant/60 pb-3">
        {['all', 'critical', 'warning', 'info'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer border ${
              filter === f ? 'bg-primary text-white border-primary' : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/60'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <Card className="p-0">
        <DataTable columns={columns} data={filteredData} />
      </Card>
    </div>
  );
}
