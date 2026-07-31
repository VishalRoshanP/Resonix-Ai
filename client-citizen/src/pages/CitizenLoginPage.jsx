import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ROUTES } from '../constants/routes';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';

export default function CitizenLoginPage() {
  const navigate = useNavigate();
  const { loginCitizen, continueAsGuest } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await loginCitizen({ email, password });
    setLoading(false);
    navigate(ROUTES.CITIZEN_HOME);
  };

  const handleGuest = () => {
    continueAsGuest();
    navigate(ROUTES.CITIZEN_HOME);
  };

  return (
    <div className="max-w-md mx-auto py-8 space-y-6 animate-fade-in text-left">
      <div className="text-center space-y-2">
        <h1 className="text-headline-lg font-extrabold text-primary">Citizen Sign In</h1>
        <p className="text-sm text-on-surface-variant">Sign in to sync your saved emergency profile</p>
      </div>

      <Card className="p-6 space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email Address"
            type="email"
            placeholder="citizen@example.com"
            icon="mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            icon="lock"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button variant="primary" size="full" type="submit" loading={loading}>
            Sign In to Citizen Portal
          </Button>
        </form>

        <div className="relative py-2 text-center">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-outline-variant/60" /></div>
          <span className="relative bg-surface-container-lowest px-3 text-xs text-on-surface-variant uppercase font-bold tracking-wider">or</span>
        </div>

        {/* Guest Mode Fallback */}
        <Button variant="secondary" size="full" icon="person_outline" onClick={handleGuest}>
          Continue as Guest (No Login Required)
        </Button>
      </Card>

      <p className="text-center text-xs text-on-surface-variant">
        Don't have a profile?{' '}
        <button
          onClick={() => navigate(ROUTES.CITIZEN_REGISTER)}
          className="font-bold text-secondary hover:underline cursor-pointer"
        >
          Create Citizen Account
        </button>
      </p>
    </div>
  );
}
