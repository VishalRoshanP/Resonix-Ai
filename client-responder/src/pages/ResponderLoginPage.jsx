import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';

export default function ResponderLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('responder@resonix.gov');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      navigate('/dashboard');
    }, 400);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between p-4 sm:p-6 animate-fade-in text-left">
      <header className="max-w-md mx-auto w-full flex justify-between items-center py-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-lg">shield</span>
          </div>
          <span className="font-extrabold text-primary text-base">RESONIX AI</span>
        </div>
        <span className="text-xs font-bold text-secondary bg-secondary/10 px-2.5 py-1 rounded-full border border-secondary/20">
          Responder Portal (Port 5174)
        </span>
      </header>

      <main className="max-w-md mx-auto w-full space-y-6 my-auto">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-extrabold text-primary">Responder Login</h1>
          <p className="text-xs text-on-surface-variant">Authorized Emergency Personnel & Administrator Authentication</p>
        </div>

        <Card className="p-6 space-y-4 border-t-4 border-t-primary">
          <form onSubmit={handleSubmit} className="space-y-4">
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

            <Button variant="primary" size="full" type="submit" loading={loading} className="mt-2">
              Login to Command Center
            </Button>
          </form>
        </Card>
      </main>

      <footer className="text-center py-4 text-xs text-on-surface-variant">
        © 2026 RESONIX AI • Connected to Shared Express Backend (Port 5000)
      </footer>
    </div>
  );
}
