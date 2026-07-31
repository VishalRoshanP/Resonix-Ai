import { useState } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { authApi } from '../../services/api';

export default function RequestAccessModal({ isOpen, onClose }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    organization: 'NDRF Disaster Response',
    department: 'Search & Water Extraction',
    badgeId: '',
    role: 'Responder',
    password: '',
    confirmPassword: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (formData.password !== formData.confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter.');
      return;
    }

    if (formData.password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await authApi.registerUser(formData);
      setSuccessMsg('✔ Request Submitted! Your account is pending Administrator approval before access is granted.');
      setTimeout(() => {
        setSuccessMsg('');
        onClose();
      }, 3000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to submit registration request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-left">
      <Card className="bg-surface border border-outline-variant max-w-xl w-full p-6 space-y-5 shadow-2xl my-auto max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b border-outline-variant/60 pb-3">
          <div>
            <h2 className="text-lg font-black text-primary tracking-tight">Request Command Center Access</h2>
            <p className="text-xs text-on-surface-variant">Authorized personnel registration requires Administrator approval</p>
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

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-primary block">Full Name *</label>
              <input
                type="text"
                name="name"
                required
                placeholder="Officer Sarah Jenkins"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-xl bg-surface-container border border-outline-variant text-xs text-primary focus:outline-none focus:border-secondary min-h-[38px]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-primary block">Official Email *</label>
              <input
                type="email"
                name="email"
                required
                placeholder="sarah.jenkins@ndrf.gov"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-xl bg-surface-container border border-outline-variant text-xs text-primary focus:outline-none focus:border-secondary min-h-[38px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-primary block">Mobile Number *</label>
              <input
                type="text"
                name="phone"
                required
                placeholder="+91 98765 43210"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-xl bg-surface-container border border-outline-variant text-xs text-primary focus:outline-none focus:border-secondary min-h-[38px]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-primary block">Badge / Employee ID *</label>
              <input
                type="text"
                name="badgeId"
                required
                placeholder="NDRF-FL-101"
                value={formData.badgeId}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-xl bg-surface-container border border-outline-variant text-xs font-mono text-primary focus:outline-none focus:border-secondary min-h-[38px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-primary block">Organization *</label>
              <input
                type="text"
                name="organization"
                required
                placeholder="National Disaster Response Force"
                value={formData.organization}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-xl bg-surface-container border border-outline-variant text-xs text-primary focus:outline-none focus:border-secondary min-h-[38px]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-primary block">Role Requested *</label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-xl bg-surface-container border border-outline-variant text-xs font-bold text-primary focus:outline-none focus:border-secondary min-h-[38px]"
              >
                <option value="Responder">Responder Squad</option>
                <option value="Coordinator">Operations Coordinator</option>
                <option value="Administrator">System Administrator</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-primary block">Password *</label>
              <input
                type="password"
                name="password"
                required
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-xl bg-surface-container border border-outline-variant text-xs text-primary focus:outline-none focus:border-secondary min-h-[38px]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-primary block">Confirm Password *</label>
              <input
                type="password"
                name="confirmPassword"
                required
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-xl bg-surface-container border border-outline-variant text-xs text-primary focus:outline-none focus:border-secondary min-h-[38px]"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-outline-variant/60 flex items-center justify-end gap-2">
            <Button variant="secondary" size="sm" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={submitting} className="font-bold px-6 min-h-[38px]">
              {submitting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
