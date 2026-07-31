import { useAuth } from '../contexts/AuthContext';
import Card from '../components/ui/Card';
import StatusChip from '../components/ui/StatusChip';
import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';

export default function ResponderAccountPage() {
  const { responderUser, responderRole } = useAuth();

  return (
    <div className="space-y-6 text-left max-w-2xl">
      <div>
        <h1 className="text-headline-lg font-bold text-primary">Responder Account Profile</h1>
        <p className="text-body-md text-on-surface-variant mt-0.5">Command Center credentials & role privilege details</p>
      </div>

      <Card className="p-6 space-y-6">
        <div className="flex items-center gap-4 border-b border-outline-variant/60 pb-5">
          <Avatar size="lg" />
          <div>
            <h2 className="text-headline-md font-bold text-primary">{responderUser?.name || 'Commander Reyes'}</h2>
            <p className="text-sm text-on-surface-variant">{responderUser?.email}</p>
            <div className="mt-2">
              <StatusChip label={`Role: ${responderRole}`} variant="critical" dot />
            </div>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-outline-variant/40">
            <span className="text-on-surface-variant">Organization</span>
            <span className="font-bold text-primary">{responderUser?.organization || 'NDRF Command Center'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-outline-variant/40">
            <span className="text-on-surface-variant">JWT Session Status</span>
            <span className="font-mono font-bold text-success">Active & Encrypted</span>
          </div>
          <div className="flex justify-between py-2 border-b border-outline-variant/40">
            <span className="text-on-surface-variant">Assigned Privileges</span>
            <span className="font-mono text-xs font-bold text-secondary">
              {(responderUser?.permissions || ['admin', 'dispatch']).join(', ')}
            </span>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <Button variant="secondary" icon="lock">Update Security Passcode</Button>
        </div>
      </Card>
    </div>
  );
}
