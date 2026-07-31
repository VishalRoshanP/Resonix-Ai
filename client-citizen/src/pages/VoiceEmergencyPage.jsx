import { useState } from 'react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import SignalConfirmationCard from '../components/cards/SignalConfirmationCard';

export default function VoiceEmergencyPage() {
  const [sent, setSent] = useState(false);
  if (sent) {
    return (
      <SignalConfirmationCard
        title="Emergency Signal Sent"
        description="Your emergency broadcast has been transmitted to all active relay nodes. Help is on the way."
        primaryActionLabel="Send Another"
        onPrimaryAction={() => setSent(false)}
      />
    );
  }
  return (
    <div className="space-y-6 max-w-lg mx-auto py-8">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-4"><span className="material-symbols-outlined text-error text-3xl">emergency</span></div>
        <h1 className="text-headline-lg font-bold text-primary">Emergency Broadcast</h1>
        <p className="text-body-md text-on-surface-variant mt-2">Send an emergency signal to all relay nodes</p>
      </div>
      <div className="space-y-4">
        <Input label="Emergency Type" placeholder="e.g., Medical, Fire, Structural" icon="category" />
        <Input label="Location / Sector" placeholder="Your current location" icon="location_on" />
        <div className="space-y-1.5">
          <label className="text-label-sm uppercase text-on-surface-variant block">Description</label>
          <textarea className="w-full bg-surface-container-lowest border border-outline-variant rounded-DEFAULT px-4 py-2.5 text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/10 transition-all min-h-[100px]" placeholder="Describe the emergency situation..." />
        </div>
      </div>
      <Button variant="urgent" size="full" icon="send" onClick={() => setSent(true)}>Broadcast Emergency Signal</Button>
    </div>
  );
}
