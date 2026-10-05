import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ROUTES } from '../../constants/routes';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';

export default function CitizenRegisterPage() {
  const navigate = useNavigate();
  const { registerCitizen, continueAsGuest } = useAuth();

  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    preferredLanguage: 'English',
    emergencyContactName: '',
    emergencyContactPhone: '',
    bloodGroup: 'O+',
    medicalConditions: '',
  });

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const LANGUAGES = [
    'English',
    'Hindi',
    'Bengali',
    'Tamil',
    'Telugu',
    'Marathi',
    'Gujarati',
    'Kannada',
    'Malayalam',
    'Punjabi',
  ];

  const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleGuestBypass = () => {
    continueAsGuest();
    navigate(ROUTES.CITIZEN_HOME);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!formData.fullName.trim()) {
      setErrorMessage('Full Name is required.');
      return;
    }
    if (!formData.phone.trim()) {
      setErrorMessage('Phone Number is required.');
      return;
    }
    if (!formData.email.trim()) {
      setErrorMessage('Email address is required.');
      return;
    }
    if (!formData.email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (formData.password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);
    try {
      await registerCitizen(formData);
      navigate(ROUTES.CITIZEN_HOME);
    } catch (err) {
      setErrorMessage(err?.message || 'Registration failed. Please check your information or continue as guest.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full py-4 sm:py-6 space-y-5 text-left animate-fade-in">
      {/* Emergency Bypass Banner */}
      <div className="bg-error/10 border-2 border-error/40 rounded-2xl p-4 text-center space-y-2">
        <div className="flex items-center justify-center gap-2 text-error font-extrabold text-sm uppercase tracking-wide">
          <span className="material-symbols-outlined text-xl animate-pulse">warning</span>
          <span>Immediate Emergency?</span>
        </div>
        <p className="text-xs text-on-surface-variant leading-relaxed">
          Skip profile setup during active disasters. Emergency SOS requires zero registration.
        </p>
        <button
          onClick={handleGuestBypass}
          className="w-full py-3 px-4 bg-error text-white font-extrabold text-sm rounded-xl hover:bg-error/90 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98"
        >
          <span className="material-symbols-outlined text-lg">bolt</span>
          <span>Skip & Continue as Guest</span>
        </button>
      </div>

      {/* Main Registration Form Card */}
      <Card className="p-4 sm:p-6 space-y-6 border border-outline-variant/60 shadow-lg">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-extrabold text-primary">Emergency Citizen Profile</h1>
          <p className="text-xs text-on-surface-variant">Register your profile for faster first-responder dispatch</p>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-error/10 border border-error/30 text-error text-xs font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-base shrink-0">error</span>
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Section 1: Account Credentials */}
          <div className="space-y-3.5 border-b border-outline-variant/60 pb-4">
            <h2 className="text-xs font-extrabold text-secondary uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">person</span>
              <span>1. Account Credentials</span>
            </h2>

            {/* Full Name */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-primary block">
                Full Name <span className="text-error">*</span>
              </label>
              <input
                type="text"
                name="fullName"
                placeholder="e.g. Alex Johnson"
                value={formData.fullName}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl bg-surface-container border border-outline-variant text-sm font-medium text-primary placeholder:text-stone-600 focus:outline-none focus:border-secondary min-h-[48px]"
                required
              />
            </div>

            {/* Phone & Email Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-primary block">
                  Phone Number <span className="text-error">*</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  placeholder="+91 9876543210"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl bg-surface-container border border-outline-variant text-sm font-medium text-primary placeholder:text-stone-600 focus:outline-none focus:border-secondary min-h-[48px]"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-primary block">
                  Email Address <span className="text-error">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  placeholder="alex@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl bg-surface-container border border-outline-variant text-sm font-medium text-primary placeholder:text-stone-600 focus:outline-none focus:border-secondary min-h-[48px]"
                  required
                />
              </div>
            </div>

            {/* Password & Confirm Password Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-primary block">
                  Password <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    placeholder="Min 6 characters"
                    value={formData.password}
                    onChange={handleChange}
                    className="w-full pl-4 pr-10 py-3 rounded-xl bg-surface-container border border-outline-variant text-sm font-medium text-primary placeholder:text-stone-600 focus:outline-none focus:border-secondary min-h-[48px]"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary cursor-pointer p-1"
                  >
                    <span className="material-symbols-outlined text-base">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-primary block">
                  Confirm Password <span className="text-error">*</span>
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  placeholder="Re-enter password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl bg-surface-container border border-outline-variant text-sm font-medium text-primary placeholder:text-stone-600 focus:outline-none focus:border-secondary min-h-[48px]"
                  required
                />
              </div>
            </div>
          </div>

          {/* Section 2: Preferences & Emergency Contacts */}
          <div className="space-y-3.5 border-b border-outline-variant/60 pb-4">
            <h2 className="text-xs font-extrabold text-secondary uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">contact_phone</span>
              <span>2. Emergency Contacts & Preferences</span>
            </h2>

            {/* Preferred Language */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-primary block">Preferred Emergency Voice Language</label>
              <select
                name="preferredLanguage"
                value={formData.preferredLanguage}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl bg-surface-container border border-outline-variant text-sm font-medium text-primary focus:outline-none focus:border-secondary min-h-[48px] cursor-pointer"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            </div>

            {/* Emergency Contact Name & Phone Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-primary block">Emergency Contact Name</label>
                <input
                  type="text"
                  name="emergencyContactName"
                  placeholder="e.g. Mary Johnson (Mother)"
                  value={formData.emergencyContactName}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl bg-surface-container border border-outline-variant text-sm font-medium text-primary placeholder:text-stone-600 focus:outline-none focus:border-secondary min-h-[48px]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-primary block">Emergency Contact Phone</label>
                <input
                  type="tel"
                  name="emergencyContactPhone"
                  placeholder="+91 9876500000"
                  value={formData.emergencyContactPhone}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl bg-surface-container border border-outline-variant text-sm font-medium text-primary placeholder:text-stone-600 focus:outline-none focus:border-secondary min-h-[48px]"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Medical Information */}
          <div className="space-y-3.5">
            <h2 className="text-xs font-extrabold text-secondary uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">medical_services</span>
              <span>3. Medical Profile (Optional for Rescuers)</span>
            </h2>

            {/* Blood Group */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-primary block">Blood Group</label>
              <select
                name="bloodGroup"
                value={formData.bloodGroup}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl bg-surface-container border border-outline-variant text-sm font-medium text-primary focus:outline-none focus:border-secondary min-h-[48px] cursor-pointer"
              >
                {BLOOD_GROUPS.map((bg) => (
                  <option key={bg} value={bg}>
                    {bg}
                  </option>
                ))}
              </select>
            </div>

            {/* Medical Conditions */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-primary block">Medical Conditions, Allergies or Notes</label>
              <textarea
                name="medicalConditions"
                rows={2}
                placeholder="e.g. Asthma, Diabetic, Penicillin allergy"
                value={formData.medicalConditions}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl bg-surface-container border border-outline-variant text-sm font-medium text-primary placeholder:text-stone-600 focus:outline-none focus:border-secondary resize-none"
              />
            </div>
          </div>

          {/* Submit Registration Button */}
          <Button variant="primary" size="full" type="submit" loading={loading} className="min-h-[48px] font-extrabold text-sm">
            Create Profile & Continue to Portal
          </Button>
        </form>

        {/* Link back to Sign In */}
        <div className="pt-2 border-t border-outline-variant/60 text-center">
          <p className="text-xs text-on-surface-variant">
            Already have a citizen profile?{' '}
            <Link to={ROUTES.CITIZEN_LOGIN} className="font-bold text-secondary hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
