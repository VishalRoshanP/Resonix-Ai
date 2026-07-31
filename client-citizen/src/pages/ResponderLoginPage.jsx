import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ROUTES } from '../constants/routes';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import StatusChip from '../components/ui/StatusChip';

export default function ResponderLoginPage() {
  const navigate = useNavigate();
  const { loginResponder } = useAuth();
  const [email, setEmail] = useState('reyes@resonix.gov');
  const [password, setPassword] = useState('password123');
  const [role, setRole] = useState('Administrator');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await loginResponder(email, password, role);
    setLoading(false);
    navigate(ROUTES.RESPONDER_DASHBOARD);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between p-4 sm:p-6 animate-fade-in">
      <header className="max-w-md mx-auto w-full flex justify-between items-center py-4">
        <button
          onClick={() => navigate(ROUTES.LANDING)}
          className="text-xs font-bold text-on-surface-variant hover:text-primary flex items-center gap-1 cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Back to Portal Entry
        </button>
        <StatusChip label="Protected" variant="critical" dot />
      </header>

      <main className="max-w-md mx-auto w-full space-y-6 my-auto">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="material-symbols-outlined text-primary text-3xl">shield</span>
          </div>
          <h1 className="text-3xl font-extrabold text-primary">Responder Login</h1>
          <p className="text-xs text-on-surface-variant">Command Center JWT Authentication & Role Dispatch</p>
        </div>

        <Card className="p-6 space-y-4 border-t-4 border-t-primary">
          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <Input
              label="Responder Email"
              type="email"
              placeholder="responder@resonix.gov"
              icon="badge"
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

            {/* Role Demo Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">
                Command Role Privileges
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['Responder', 'Coordinator', 'Administrator'].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`py-2 px-2 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                      role === r
                        ? 'bg-primary text-white border-primary shadow-xs'
                        : 'bg-surface-container-low text-on-surface-variant border-outline-variant/60 hover:bg-surface-container'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <Button variant="primary" size="full" type="submit" loading={loading} className="mt-2">
              Authenticate & Launch Command Center
            </Button>
          </form>
        </Card>

        <p className="text-center text-xs text-on-surface-variant">
          Emergency Citizen Portal?{' '}
          <button
            onClick={() => navigate(ROUTES.CITIZEN_HOME)}
            className="font-bold text-secondary hover:underline cursor-pointer"
          >
            Switch to Citizen Mode
          </button>
        </p>
      </main>

      <footer className="text-center py-4 text-xs text-on-surface-variant">
        © 2026 RESONIX AI • Role-Based Responder Authentication System
      </footer>
    </div>
  );
}
