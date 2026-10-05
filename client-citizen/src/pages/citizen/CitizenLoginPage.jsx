import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ROUTES } from '../../constants/routes';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';

export default function CitizenLoginPage() {
  const navigate = useNavigate();
  const { loginCitizen, continueAsGuest, forgotPassword } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleGuestBypass = () => {
    continueAsGuest();
    navigate(ROUTES.CITIZEN_HOME);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier) {
      setErrorMessage('Please enter your email or mobile number.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      await loginCitizen({ email: cleanIdentifier, password, rememberMe });
      navigate(ROUTES.CITIZEN_HOME);
    } catch (err) {
      setErrorMessage(err?.message || 'Authentication failed. Please check your credentials or continue as guest.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    try {
      await forgotPassword(forgotEmail.trim());
    } catch {
      // Graceful fallback for UI feedback
    } finally {
      setForgotLoading(false);
      setForgotSubmitted(true);
    }
  };

  return (
    <div className="w-full py-4 sm:py-6 space-y-5 text-left animate-fade-in">
      {/* Emergency SOS Direct Bypass Header Banner */}
      <div className="bg-error/10 border-2 border-error/40 rounded-2xl p-4 shadow-sm text-center space-y-2">
        <div className="flex items-center justify-center gap-2 text-error font-extrabold text-sm uppercase tracking-wide">
          <span className="material-symbols-outlined text-xl animate-pulse">emergency</span>
          <span>In an Active Disaster?</span>
        </div>
        <p className="text-xs text-on-surface-variant leading-relaxed">
          Emergency SOS reporting <strong className="text-primary">never</strong> requires sign in or registration.
        </p>
        <button
          onClick={handleGuestBypass}
          className="w-full py-3 px-4 bg-error text-white font-extrabold text-sm rounded-xl hover:bg-error/90 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98"
        >
          <span className="material-symbols-outlined text-lg">bolt</span>
          <span>Continue as Guest (1-Tap SOS)</span>
        </button>
      </div>

      {/* Main Sign In Form Card */}
      <Card className="p-4 sm:p-6 space-y-5 border border-outline-variant/60 shadow-lg">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-extrabold text-primary">Citizen Sign In</h1>
          <p className="text-xs text-on-surface-variant">Sign in to sync emergency history & contact details</p>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-error/10 border border-error/30 text-error text-xs font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-base shrink-0">error</span>
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          {/* Email or Mobile Number Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-primary block">
              Email or Mobile Number <span className="text-error">*</span>
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">
                account_circle
              </span>
              <input
                type="text"
                placeholder="email@example.com or +91 9876543210"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-surface-container border border-outline-variant text-sm font-medium text-primary placeholder:text-stone-600 focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-all min-h-[48px]"
                required
              />
            </div>
          </div>

          {/* Password Input with Show/Hide Toggle */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-primary block">
              Password <span className="text-error">*</span>
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">
                lock
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-3 rounded-xl bg-surface-container border border-outline-variant text-sm font-medium text-primary placeholder:text-stone-600 focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-all min-h-[48px]"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors p-1 cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                <span className="material-symbols-outlined text-lg">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          {/* Remember Me & Forgot Password Row */}
          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 font-medium text-on-surface-variant cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-outline-variant text-secondary focus:ring-secondary accent-secondary cursor-pointer"
              />
              <span>Remember Me</span>
            </label>

            <button
              type="button"
              onClick={() => setShowForgotModal(true)}
              className="font-bold text-secondary hover:underline cursor-pointer"
            >
              Forgot Password?
            </button>
          </div>

          {/* Submit Login Button */}
          <Button variant="primary" size="full" type="submit" loading={loading} className="min-h-[48px] font-extrabold text-sm">
            Sign In to Citizen Portal
          </Button>
        </form>

        {/* Navigation to Registration */}
        <div className="pt-2 border-t border-outline-variant/60 text-center">
          <p className="text-xs text-on-surface-variant">
            Don't have a citizen profile?{' '}
            <Link to={ROUTES.CITIZEN_REGISTER} className="font-bold text-secondary hover:underline">
              Create Emergency Profile
            </Link>
          </p>
        </div>
      </Card>

      {/* Interactive Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-outline-variant">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-primary">Password Recovery</h3>
              <button
                onClick={() => {
                  setShowForgotModal(false);
                  setForgotSubmitted(false);
                }}
                className="p-1 text-on-surface-variant hover:text-primary rounded-lg cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {!forgotSubmitted ? (
              <form onSubmit={handleForgotSubmit} className="space-y-4 text-left">
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Enter your registered email address or mobile number to receive a verification reset link.
                </p>
                <input
                  type="text"
                  placeholder="email@example.com or +91 9876543210"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-surface-container border border-outline-variant text-sm font-medium text-primary focus:outline-none focus:border-secondary min-h-[48px]"
                  required
                />
                <div className="flex gap-2 justify-end pt-2">
                  <Button variant="ghost" size="sm" type="button" onClick={() => setShowForgotModal(false)}>
                    Cancel
                  </Button>

                  <Button variant="primary" size="sm" type="submit">
                    Send Reset Link
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-3 text-center py-2">
                <div className="w-12 h-12 bg-success/10 border border-success/30 rounded-full flex items-center justify-center mx-auto text-success">
                  <span className="material-symbols-outlined text-2xl">check_circle</span>
                </div>
                <p className="text-xs font-semibold text-primary">
                  Password reset link sent to <span className="font-bold text-secondary">{forgotEmail}</span>.
                </p>
                <Button
                  variant="secondary"
                  size="full"
                  onClick={() => {
                    setShowForgotModal(false);
                    setForgotSubmitted(false);
                  }}
                >
                  Return to Sign In
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
