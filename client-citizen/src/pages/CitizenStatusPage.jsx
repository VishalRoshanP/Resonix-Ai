import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import Card from '../components/ui/Card';
import StatusChip from '../components/ui/StatusChip';
import Button from '../components/ui/Button';

export default function CitizenStatusPage() {
  const navigate = useNavigate();

  const statuses = [
    {
      id: 'SOS-2024-8841',
      type: 'Flash Flood Rescue Request',
      time: '12 mins ago',
      status: 'active',
      statusLabel: 'Dispatch Active',
      details: 'Transmitted to 47 mesh relay nodes. Emergency Response Unit Alpha dispatched.',
      eta: '8 minutes',
    },
    {
      id: 'SOS-2024-4102',
      type: 'Medical Check-In',
      time: '2 hours ago',
      status: 'resolved',
      statusLabel: 'Acknowledged',
      details: 'First responder checked in at Sector 4 perimeter.',
      eta: 'Resolved',
    },
  ];

  return (
    <div className="max-w-md mx-auto py-4 space-y-5 animate-fade-in text-left">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-headline-md font-bold text-primary">Emergency Request Status</h1>
          <p className="text-xs text-on-surface-variant">Live broadcast feedback & relay tracking</p>
        </div>
        <Button variant="urgent" size="sm" icon="sos" onClick={() => navigate(ROUTES.CITIZEN_SOS)}>
          New SOS
        </Button>
      </div>

      <div className="space-y-4">
        {statuses.map((item) => (
          <Card key={item.id} className="p-5 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <span className="font-mono text-[11px] text-on-surface-variant font-bold block">{item.id}</span>
                <h3 className="font-bold text-primary text-base">{item.type}</h3>
              </div>
              <StatusChip label={item.statusLabel} variant={item.status === 'active' ? 'active' : 'resolved'} dot />
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">{item.details}</p>

            <div className="pt-3 border-t border-outline-variant/40 flex justify-between items-center text-xs">
              <span className="text-on-surface-variant">{item.time}</span>
              <span className="font-mono font-bold text-secondary flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">schedule</span>
                ETA: {item.eta}
              </span>
            </div>
          </Card>
        ))}
      </div>

      <Button variant="secondary" size="full" icon="arrow_back" onClick={() => navigate(ROUTES.CITIZEN_HOME)}>
        Return to Emergency Home
      </Button>
    </div>
  );
}
