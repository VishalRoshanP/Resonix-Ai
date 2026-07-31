import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, ROLES } from '../contexts/AuthContext';
import { RESPONDER_ROUTES } from '../constants/routes';
import ForgotPasswordModal from '../components/auth/ForgotPasswordModal';
import RequestAccessModal from '../components/auth/RequestAccessModal';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();

  const [identifier, setIdentifier] = useState('responder@resonix.gov');
  const [password, setPassword] = useState('password123');
  const [selectedRole, setSelectedRole] = useState(ROLES.RESPONDER);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [demoMode, setDemoMode] = useState(true);

  const [showForgotModal, setShowForgotModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Redirect authenticated responders to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      navigate(RESPONDER_ROUTES.DASHBOARD, { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const DEMO_ACCOUNTS = {
    [ROLES.RESPONDER]: {
      identifier: 'responder@resonix.gov',
      badgeId: 'NDRF-FL-101',
      label: 'Responder Squad',
      desc: 'Field Operations & Rescue Triage',
      organization: 'NDRF Battalion 4',
    },
    [ROLES.COORDINATOR]: {
      identifier: 'coordinator@resonix.gov',
      badgeId: 'NDMA-COORD-202',
      label: 'Operations Coordinator',
      desc: 'Resource Dispatch & Tasking',
      organization: 'NDMA Command',
    },
    [ROLES.ADMINISTRATOR]: {
      identifier: 'admin@resonix.gov',
      badgeId: 'RESONIX-ADM-303',
      label: 'System Administrator',
      desc: 'Full Access & Personnel Approval',
      organization: 'RESONIX AI Command Center',
    },
  };

  const handleRoleSelect = (roleKey) => {
    setSelectedRole(roleKey);
    setIdentifier(DEMO_ACCOUNTS[roleKey].identifier);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setLoginError('');

    try {
      await login(identifier, password, selectedRole, rememberMe);
      navigate(RESPONDER_ROUTES.DASHBOARD);
    } catch (err) {
      setLoginError(err.message || 'Invalid credentials or account pending Administrator approval.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between p-4 sm:p-6 text-left animate-fade-in">
      {/* Top Header Bar */}
      <header className="max-w-xl mx-auto w-full flex justify-between items-center py-3 border-b border-outline-variant/60">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-secondary/15 border border-secondary/30 flex items-center justify-center text-secondary shadow-md">
            <span className="material-symbols-outlined text-xl">shield</span>
          </div>
          <div>
            <span className="font-black text-primary text-base tracking-wider block leading-none">RESONIX AI</span>
            <span className="text-[10px] font-mono text-on-surface-variant">Emergency Operations Command</span>
          </div>
        </div>

        {/* Demo Mode Toggle Switch */}
        <div className="flex items-center gap-2 bg-surface-container p-1 rounded-xl border border-outline-variant/60">
          <span className="text-[10px] font-mono font-extrabold text-on-surface-variant px-2">
            Demo Auth
          </span>
          <button
            type="button"
            onClick={() => setDemoMode(!demoMode)}
            className={`px-3 py-1 rounded-lg text-[10px] font-mono font-black transition-all cursor-pointer ${
              demoMode ? 'bg-success text-white' : 'bg-surface text-on-surface-variant border border-outline-variant'
            }`}
          >
            {demoMode ? 'ENABLED' : 'DISABLED'}
          </button>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="max-w-xl mx-auto w-full space-y-4 my-auto py-4">
        <div className="text-center space-y-1">
          <h1 className="text-2xl sm:text-3xl font-black text-primary tracking-tight">Command Center Login</h1>
          <p className="text-xs text-on-surface-variant">Authorized Emergency Responders & Operations Command Staff</p>
        </div>

        <Card className="p-6 sm:p-8 space-y-5 border-t-4 border-t-secondary shadow-2xl bg-gradient-to-b from-surface to-surface-container">
          {/* Demo Mode Seeded Account Selector */}
          {demoMode && (
            <div className="space-y-1.5 p-3 rounded-2xl bg-secondary/10 border border-secondary/30">
              <span className="text-[10px] font-mono font-extrabold text-secondary uppercase block">
                ⚡ Demo Quick Login Accounts
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {Object.keys(DEMO_ACCOUNTS).map((roleKey) => {
                  const isSelected = selectedRole === roleKey;
                  return (
                    <button
                      key={roleKey}
                      type="button"
                      onClick={() => handleRoleSelect(roleKey)}
                      className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-secondary text-white border-secondary shadow-md font-bold'
                          : 'bg-surface hover:bg-surface-container-high border-outline-variant/60 text-primary'
                      }`}
                    >
                      <span className="text-[11px] font-extrabold block truncate">{DEMO_ACCOUNTS[roleKey].label}</span>
                      <span className="text-[9px] font-mono opacity-80 block truncate">Badge: {DEMO_ACCOUNTS[roleKey].badgeId}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {loginError && (
            <div className="p-3 rounded-xl bg-error/15 border border-error/30 text-error text-xs font-bold flex items-center gap-2 animate-fade-in shadow-sm">
              <span className="material-symbols-outlined text-base">warning</span>
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Identifier: Email OR Badge ID */}
            <div className="space-y-1">
              <label className="font-bold text-primary block">Official Email OR Badge ID *</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="responder@resonix.gov OR NDRF-FL-101"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-surface-container border border-outline-variant text-xs text-primary focus:outline-none focus:border-secondary min-h-[40px]"
                />
                <span className="material-symbols-outlined text-base text-on-surface-variant absolute left-3 top-2.5">
                  badge
                </span>
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="font-bold text-primary block">Password *</label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-[11px] font-mono text-secondary hover:underline cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-surface-container border border-outline-variant text-xs text-primary focus:outline-none focus:border-secondary min-h-[40px]"
                />
                <span className="material-symbols-outlined text-base text-on-surface-variant absolute left-3 top-2.5">
                  lock
                </span>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-on-surface-variant hover:text-primary cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-on-surface-variant font-medium">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded text-secondary border-outline-variant focus:ring-secondary cursor-pointer"
                />
                <span>Maintain Secure Session (Remember Me)</span>
              </label>
            </div>

            {/* Login Action Button */}
            <Button
              variant="primary"
              size="md"
              type="submit"
              disabled={loading}
              className="w-full font-black text-xs min-h-[42px] uppercase tracking-wider shadow-lg"
            >
              {loading ? 'Authenticating Credentials...' : 'Sign In to Command Center ➔'}
            </Button>
          </form>

          {/* Request Access Action Footer */}
          <div className="pt-3 border-t border-outline-variant/60 flex items-center justify-between text-xs">
            <span className="text-on-surface-variant font-medium">New Responder or Officer?</span>
            <button
              type="button"
              onClick={() => setShowRequestModal(true)}
              className="font-mono font-bold text-secondary hover:underline cursor-pointer bg-secondary/10 px-3 py-1.5 rounded-lg border border-secondary/30"
            >
              Request Access ➔
            </button>
          </div>
        </Card>
      </main>

      {/* Footer */}
      <footer className="text-center text-[10px] font-mono text-on-surface-variant py-2">
        RESONIX AI Emergency Management System • JWT Authenticated & Bcrypt Encrypted
      </footer>

      {/* Modals */}
      <ForgotPasswordModal isOpen={showForgotModal} onClose={() => setShowForgotModal(false)} />
      <RequestAccessModal isOpen={showRequestModal} onClose={() => setShowRequestModal(false)} />
    </div>
  );
}
