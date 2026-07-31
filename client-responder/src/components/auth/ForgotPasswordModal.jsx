import { useState } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { authApi } from '../../services/api';

export default function ForgotPasswordModal({ isOpen, onClose }) {
  const [step, setStep] = useState(1); // 1: Identifier input, 2: OTP verification & New Password
  const [identifier, setIdentifier] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [demoOtpMsg, setDemoOtpMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  // Step 1: Request OTP
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!identifier.trim()) return;

    setLoading(true);
    setErrorMsg('');
    try {
      const res = await authApi.forgotPassword(identifier.trim());
      setDemoOtpMsg(res.message || 'OTP reset token dispatched.');
      setStep(2);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to generate password reset token.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP & Reset Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter.');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.resetPassword(identifier.trim(), otpCode.trim(), newPassword);
      setSuccessMsg('✔ Password Updated Successfully! You may now sign in with your new credentials.');
      setTimeout(() => {
        setSuccessMsg('');
        onClose();
        setStep(1);
      }, 2500);
    } catch (err) {
      setErrorMsg(err.message || 'Invalid or expired OTP code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-left">
      <Card className="bg-surface border border-outline-variant max-w-md w-full p-6 space-y-5 shadow-2xl my-auto">
        <div className="flex justify-between items-center border-b border-outline-variant/60 pb-3">
          <div>
            <h2 className="text-base font-black text-primary tracking-tight">Password Recovery Triage</h2>
            <p className="text-xs text-on-surface-variant">Step {step} of 2: {step === 1 ? 'Enter Credentials' : 'Verify OTP & Reset Password'}</p>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-primary cursor-pointer">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {successMsg && (
          <div className="p-3 rounded-xl bg-success/15 border border-success/30 text-success text-xs font-bold flex items-center gap-2 animate-fade-in">
            <span className="material-symbols-outlined text-base">check_circle</span>
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-xl bg-error/15 border border-error/30 text-error text-xs font-bold flex items-center gap-2 animate-fade-in">
            <span className="material-symbols-outlined text-base">warning</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {demoOtpMsg && step === 2 && (
          <div className="p-3 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400 text-xs font-mono font-bold space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">vpn_key</span>
              <span>Backend Demo Console Dispatch</span>
            </div>
            <p className="text-[11px] font-normal text-on-surface-variant leading-relaxed">
              {demoOtpMsg}
            </p>
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleRequestOtp} className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-primary block">Official Email OR Badge ID *</label>
              <input
                type="text"
                required
                placeholder="responder@resonix.gov OR NDRF-FL-101"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-surface-container border border-outline-variant text-xs text-primary focus:outline-none focus:border-secondary min-h-[40px]"
              />
              <span className="text-[10px] text-on-surface-variant block mt-1">
                Enter your registered official email address or assigned Badge ID.
              </span>
            </div>

            <div className="pt-2 border-t border-outline-variant/60 flex items-center justify-end gap-2">
              <Button variant="secondary" size="sm" type="button" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" disabled={loading} className="font-bold px-6 min-h-[40px]">
                {loading ? 'Generating...' : 'Generate Reset OTP ➔'}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-primary block">6-Digit Reset OTP Code *</label>
              <input
                type="text"
                required
                placeholder="Enter 6-digit OTP code..."
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-surface-container border border-outline-variant text-xs font-mono font-bold text-primary focus:outline-none focus:border-secondary min-h-[40px]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-primary block">New Password *</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-surface-container border border-outline-variant text-xs text-primary focus:outline-none focus:border-secondary min-h-[40px]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-primary block">Confirm New Password *</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-surface-container border border-outline-variant text-xs text-primary focus:outline-none focus:border-secondary min-h-[40px]"
              />
            </div>

            <div className="pt-2 border-t border-outline-variant/60 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-[11px] font-mono text-secondary hover:underline cursor-pointer"
              >
                ← Back
              </button>
              <Button variant="primary" size="sm" type="submit" disabled={loading} className="font-bold px-6 min-h-[40px]">
                {loading ? 'Updating...' : 'Update Password'}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
