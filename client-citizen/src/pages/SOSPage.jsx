import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import SignalConfirmationCard from '../components/cards/SignalConfirmationCard';

export default function SOSPage() {
  const navigate = useNavigate();
  return (
    <SignalConfirmationCard
      title="SOS Signal Submitted"
      description="Your emergency SOS has been broadcasted to 47 active relay nodes across the mesh network."
      details={[
        { label: 'Signal ID', value: 'SOS-2024-1847' },
        { label: 'Broadcast Time', value: '14:52:03 UTC' },
        { label: 'Nodes Reached', value: '47 / 50', variant: 'success' },
        { label: 'Estimated Response', value: '~8 minutes', variant: 'secondary' },
      ]}
      primaryActionLabel="Return to Citizen Portal"
      onPrimaryAction={() => navigate(ROUTES.CITIZEN_HOME)}
      secondaryActionLabel="View Incident Status"
      onSecondaryAction={() => navigate(ROUTES.CITIZEN_STATUS)}
    />
  );
}
