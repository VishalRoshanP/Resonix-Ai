import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ROUTES } from '../../constants/routes';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';

export default function CitizenProfilePage() {
  const navigate = useNavigate();
  const { citizenUser, isCitizenGuest, guestId, logoutCitizen, updateUserProfile } = useAuth();

  // Profile Form States
  const [profileData, setProfileData] = useState({
    fullName: citizenUser?.name || '',
    phone: citizenUser?.phone || '',
    email: citizenUser?.email || '',
    address: citizenUser?.address || '',
    city: citizenUser?.city || '',
    autoShareGps: citizenUser?.autoShareGps !== undefined ? citizenUser.autoShareGps : true,
    emergencyContactName: citizenUser?.emergencyContactName || '',
    emergencyContactPhone: citizenUser?.emergencyContactPhone || '',
    secondaryContactName: citizenUser?.secondaryContactName || '',
    secondaryContactPhone: citizenUser?.secondaryContactPhone || '',
    bloodGroup: citizenUser?.bloodGroup || '',
    preferredLanguage: citizenUser?.language || citizenUser?.preferredLanguage || 'English',
    medicalConditions: citizenUser?.medicalConditions || '',
  });

  const [avatarPreview, setAvatarPreview] = useState(citizenUser?.avatarUrl || null);
  const [activeTab, setActiveTab] = useState('PERSONAL'); // 'PERSONAL' | 'CONTACTS' | 'MEDICAL' | 'HISTORY'
  const [saveSuccessMessage, setSaveSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [emergencyHistory, setEmergencyHistory] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    import('../../services/sqliteStorageEngine').then(({ sqliteStorageEngine }) => {
      sqliteStorageEngine.getAllSOS().then((records) => {
        setEmergencyHistory(records || []);
      }).catch(() => setEmergencyHistory([]));
    });
  }, []);

  // Synchronize profile data when citizenUser updates
  useEffect(() => {
    if (citizenUser) {
      setProfileData((prev) => ({
        ...prev,
        fullName: citizenUser.name || prev.fullName,
        email: citizenUser.email || prev.email,
        phone: citizenUser.phone || prev.phone,
        preferredLanguage: citizenUser.language || citizenUser.preferredLanguage || prev.preferredLanguage,
        address: citizenUser.address !== undefined ? citizenUser.address : prev.address,
        city: citizenUser.city !== undefined ? citizenUser.city : prev.city,
        autoShareGps: citizenUser.autoShareGps !== undefined ? citizenUser.autoShareGps : prev.autoShareGps,
        emergencyContactName: citizenUser.emergencyContactName !== undefined ? citizenUser.emergencyContactName : prev.emergencyContactName,
        emergencyContactPhone: citizenUser.emergencyContactPhone !== undefined ? citizenUser.emergencyContactPhone : prev.emergencyContactPhone,
        secondaryContactName: citizenUser.secondaryContactName !== undefined ? citizenUser.secondaryContactName : prev.secondaryContactName,
        secondaryContactPhone: citizenUser.secondaryContactPhone !== undefined ? citizenUser.secondaryContactPhone : prev.secondaryContactPhone,
        bloodGroup: citizenUser.bloodGroup !== undefined ? citizenUser.bloodGroup : prev.bloodGroup,
        medicalConditions: citizenUser.medicalConditions !== undefined ? citizenUser.medicalConditions : prev.medicalConditions,
      }));
      if (citizenUser.avatarUrl) {
        setAvatarPreview(citizenUser.avatarUrl);
      }
    }
  }, [citizenUser]);

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
    const { name, value, type, checked } = e.target;
    setProfileData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAvatarPreview(url);
      setProfileData((prev) => ({ ...prev, avatarUrl: url }));
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSaveSuccessMessage('');

    if (!profileData.fullName.trim()) {
      setErrorMessage('Full Name is required.');
      return;
    }
    if (!profileData.email.trim() || !profileData.email.includes('@')) {
      setErrorMessage('A valid Email Address is required.');
      return;
    }
    if (!profileData.phone.trim()) {
      setErrorMessage('Phone Number is required.');
      return;
    }

    setIsSaving(true);
    try {
      if (updateUserProfile) {
        await updateUserProfile(profileData);
      }
      setSaveSuccessMessage('✅ Profile modifications saved successfully.');
      setTimeout(() => setSaveSuccessMessage(''), 4000);
    } catch (err) {
      setErrorMessage(err?.message || 'Failed to update profile modifications. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // ----------------------------------------------------
  // GUEST PROFILE VIEW (Simplified Session View)
  // ----------------------------------------------------
  if (isCitizenGuest) {
    return (
      <div className="w-full py-4 sm:py-6 space-y-5 text-left animate-fade-in">
        {/* Header Title */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-extrabold text-primary">Citizen Profile</h1>
          <p className="text-xs text-on-surface-variant">Temporary Guest Session Profile</p>
        </div>

        {/* Guest Session Status Card */}
        <Card className="p-6 space-y-4 border-2 border-secondary/30 shadow-lg text-center bg-gradient-to-b from-surface to-secondary/5">
          <div className="w-20 h-20 bg-secondary/10 border-2 border-secondary/30 rounded-full flex items-center justify-center mx-auto text-secondary shadow-md">
            <span className="material-symbols-outlined text-4xl">account_circle</span>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-mono font-extrabold uppercase px-2.5 py-1 bg-secondary text-white rounded-full">
              Anonymous Guest Session
            </span>
            <h2 className="text-base font-extrabold text-primary pt-1">Guest Session ID</h2>
            <p className="text-xs font-mono font-bold text-secondary bg-surface-container py-1.5 px-3 rounded-lg border border-outline-variant inline-block">
              {guestId || 'guest_session_active'}
            </p>
          </div>

          <p className="text-xs text-on-surface-variant leading-relaxed">
            You are operating in <strong className="text-primary">1-Tap Emergency Guest Mode</strong>. No account login is required to send high-priority SOS telemetry.
          </p>
        </Card>

        {/* Active Guest Capabilities Matrix */}
        <Card className="p-5 space-y-3 border border-outline-variant/60">
          <h3 className="text-xs font-extrabold text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-outline-variant/60 pb-2">
            <span className="material-symbols-outlined text-secondary text-base">verified_user</span>
            <span>Active Guest Capabilities</span>
          </h3>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2 rounded-xl bg-success/10 border border-success/20 text-success font-bold">
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base">emergency</span>
                <span>Send Emergency SOS</span>
              </span>
              <span>ACTIVE</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-success/10 border border-success/20 text-success font-bold">
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base">mic</span>
                <span>Voice Telemetry Recording</span>
              </span>
              <span>ACTIVE</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-success/10 border border-success/20 text-success font-bold">
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base">my_location</span>
                <span>Live GPS Location Sharing</span>
              </span>
              <span>ACTIVE</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-surface-container border border-outline-variant text-on-surface-variant font-medium">
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base">history</span>
                <span>Saved History & Medical Alerts</span>
              </span>
              <span className="text-[10px] font-mono bg-outline-variant/30 px-2 py-0.5 rounded">RESTRICTED</span>
            </div>
          </div>
        </Card>

        {/* Upgrade Banner & Action Buttons */}
        <div className="bg-surface-container-high border border-outline-variant rounded-2xl p-5 space-y-3 text-center shadow-md">
          <div className="flex items-center justify-center gap-2 text-secondary font-bold text-sm">
            <span className="material-symbols-outlined text-lg">badge</span>
            <span>Want Saved Emergency Contacts?</span>
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Create a free citizen profile to save your blood group, medical conditions, and emergency contacts for first responders.
          </p>
          <div className="space-y-2 pt-1">
            <Button
              variant="primary"
              size="full"
              onClick={() => navigate(ROUTES.CITIZEN_REGISTER)}
              className="font-extrabold text-sm min-h-[48px]"
            >
              Create Free Citizen Profile
            </Button>

            <Button
              variant="secondary"
              size="full"
              onClick={() => navigate(ROUTES.CITIZEN_LOGIN)}
              className="min-h-[44px]"
            >
              Sign In to Existing Account
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // REGISTERED CITIZEN PROFILE VIEW (Full Profile)
  // ----------------------------------------------------
  return (
    <div className="w-full py-4 sm:py-6 space-y-5 text-left animate-fade-in">
      {/* Header Profile Section */}
      <Card className="p-4 sm:p-5 border border-outline-variant/60 shadow-md space-y-4">
        <div className="flex items-center gap-4">
          {/* Avatar Photo Container */}
          <div className="relative shrink-0">
            <div className="w-16 h-16 rounded-full bg-secondary/15 border-2 border-secondary overflow-hidden flex items-center justify-center">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Profile avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="material-symbols-outlined text-secondary text-3xl">person</span>
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 bg-secondary text-white rounded-full p-1 shadow-md hover:bg-secondary/90 cursor-pointer"
              title="Change profile photo"
            >
              <span className="material-symbols-outlined text-xs">photo_camera</span>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-lg font-extrabold text-primary truncate">{profileData.fullName}</h1>
              <span className="material-symbols-outlined text-secondary text-base" title="Verified Profile">
                verified
              </span>
            </div>
            <p className="text-xs text-on-surface-variant truncate">{profileData.email}</p>
            <span className="inline-block mt-1 text-[10px] font-bold text-success bg-success/10 px-2 py-0.5 rounded-full border border-success/30">
              Registered Citizen Account
            </span>
          </div>
        </div>

        {/* Tab Navigation Pill Header */}
        <div className="grid grid-cols-4 gap-1 p-1 bg-surface-container rounded-xl border border-outline-variant text-[10px] sm:text-[11px] font-bold">
          <button
            onClick={() => setActiveTab('PERSONAL')}
            className={`py-2 px-1 rounded-lg transition-colors cursor-pointer truncate ${
              activeTab === 'PERSONAL' ? 'bg-secondary text-white shadow-xs' : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            Personal
          </button>
          <button
            onClick={() => setActiveTab('CONTACTS')}
            className={`py-2 px-1 rounded-lg transition-colors cursor-pointer truncate ${
              activeTab === 'CONTACTS' ? 'bg-secondary text-white shadow-xs' : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            Contacts
          </button>
          <button
            onClick={() => setActiveTab('MEDICAL')}
            className={`py-2 px-1 rounded-lg transition-colors cursor-pointer truncate ${
              activeTab === 'MEDICAL' ? 'bg-secondary text-white shadow-xs' : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            Medical
          </button>
          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`py-2 px-1 rounded-lg transition-colors cursor-pointer truncate ${
              activeTab === 'HISTORY' ? 'bg-secondary text-white shadow-xs' : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            History
          </button>
        </div>
      </Card>

      {errorMessage && (
        <div className="p-3 rounded-xl bg-error/15 border border-error/30 text-error text-xs font-bold flex items-center gap-2 animate-fade-in">
          <span className="material-symbols-outlined text-base">error</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {saveSuccessMessage && (
        <div className="p-3 rounded-xl bg-success/15 border border-success/30 text-success text-xs font-bold flex items-center gap-2 animate-fade-in">
          <span className="material-symbols-outlined text-base">check_circle</span>
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {/* Main Profile Tab Content Form */}
      <Card className="p-6 border border-outline-variant/60 shadow-lg space-y-5">
        <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
          {/* TAB 1: PERSONAL & LOCATION */}
          {activeTab === 'PERSONAL' && (
            <div className="space-y-4 animate-fade-in">
              <h2 className="text-xs font-extrabold text-secondary uppercase tracking-wider flex items-center gap-1.5 border-b border-outline-variant/60 pb-2">
                <span className="material-symbols-outlined text-base">badge</span>
                <span>Personal & Location Preferences</span>
              </h2>

              <div className="space-y-1">
                <label className="font-bold text-primary block">Full Name</label>
                <input
                  type="text"
                  name="fullName"
                  value={profileData.fullName}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container border border-outline-variant text-xs font-medium text-primary focus:outline-none focus:border-secondary min-h-[44px]"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-primary block">Phone Number</label>
                <input
                  type="tel"
                  name="phone"
                  value={profileData.phone}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container border border-outline-variant text-xs font-medium text-primary focus:outline-none focus:border-secondary min-h-[44px]"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-primary block">Email Address</label>
                <input
                  type="email"
                  name="email"
                  value={profileData.email}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container border border-outline-variant text-xs font-medium text-primary focus:outline-none focus:border-secondary min-h-[44px]"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-primary block">Home Address</label>
                <input
                  type="text"
                  name="address"
                  value={profileData.address}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container border border-outline-variant text-xs font-medium text-primary focus:outline-none focus:border-secondary min-h-[44px]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-primary block">Primary City / Region</label>
                <input
                  type="text"
                  name="city"
                  value={profileData.city}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container border border-outline-variant text-xs font-medium text-primary focus:outline-none focus:border-secondary min-h-[44px]"
                />
              </div>

              <label className="flex items-center gap-2 p-3 rounded-xl bg-surface-container border border-outline-variant cursor-pointer pt-2">
                <input
                  type="checkbox"
                  name="autoShareGps"
                  checked={profileData.autoShareGps}
                  onChange={handleChange}
                  className="w-4 h-4 rounded text-secondary focus:ring-secondary accent-secondary cursor-pointer"
                />
                <div>
                  <span className="font-bold text-primary block">Auto-Share GPS on SOS</span>
                  <span className="text-[10px] text-on-surface-variant">Automatically attach live coordinates to emergency packets</span>
                </div>
              </label>
            </div>
          )}

          {/* TAB 2: EMERGENCY CONTACTS */}
          {activeTab === 'CONTACTS' && (
            <div className="space-y-4 animate-fade-in">
              <h2 className="text-xs font-extrabold text-secondary uppercase tracking-wider flex items-center gap-1.5 border-b border-outline-variant/60 pb-2">
                <span className="material-symbols-outlined text-base">contact_phone</span>
                <span>Emergency Contacts</span>
              </h2>

              <div className="space-y-3 p-3 rounded-xl bg-surface-container border border-outline-variant">
                <span className="text-[10px] font-bold text-secondary uppercase tracking-wider block">Primary Emergency Contact</span>
                <div className="space-y-1">
                  <label className="font-bold text-primary block">Contact Name & Relationship</label>
                  <input
                    type="text"
                    name="emergencyContactName"
                    value={profileData.emergencyContactName}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant text-xs font-medium text-primary focus:outline-none focus:border-secondary min-h-[44px]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-primary block">Contact Phone Number</label>
                  <input
                    type="tel"
                    name="emergencyContactPhone"
                    value={profileData.emergencyContactPhone}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant text-xs font-medium text-primary focus:outline-none focus:border-secondary min-h-[44px]"
                  />
                </div>
              </div>

              <div className="space-y-3 p-3 rounded-xl bg-surface-container border border-outline-variant">
                <span className="text-[10px] font-bold text-secondary uppercase tracking-wider block">Secondary Emergency Contact</span>
                <div className="space-y-1">
                  <label className="font-bold text-primary block">Contact Name & Relationship</label>
                  <input
                    type="text"
                    name="secondaryContactName"
                    value={profileData.secondaryContactName}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant text-xs font-medium text-primary focus:outline-none focus:border-secondary min-h-[44px]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-primary block">Contact Phone Number</label>
                  <input
                    type="tel"
                    name="secondaryContactPhone"
                    value={profileData.secondaryContactPhone}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant text-xs font-medium text-primary focus:outline-none focus:border-secondary min-h-[44px]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MEDICAL & LANGUAGE */}
          {activeTab === 'MEDICAL' && (
            <div className="space-y-4 animate-fade-in">
              <h2 className="text-xs font-extrabold text-secondary uppercase tracking-wider flex items-center gap-1.5 border-b border-outline-variant/60 pb-2">
                <span className="material-symbols-outlined text-base">medical_services</span>
                <span>Medical Profile & Language</span>
              </h2>

              <div className="space-y-1">
                <label className="font-bold text-primary block">Blood Group</label>
                <select
                  name="bloodGroup"
                  value={profileData.bloodGroup}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container border border-outline-variant text-xs font-medium text-primary focus:outline-none focus:border-secondary min-h-[44px] cursor-pointer"
                >
                  {BLOOD_GROUPS.map((bg) => (
                    <option key={bg} value={bg}>
                      {bg}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-primary block">Preferred Emergency Voice Language</label>
                <select
                  name="preferredLanguage"
                  value={profileData.preferredLanguage}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container border border-outline-variant text-xs font-medium text-primary focus:outline-none focus:border-secondary min-h-[44px] cursor-pointer"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-primary block">Medical Conditions, Allergies or Notes</label>
                <textarea
                  name="medicalConditions"
                  rows={3}
                  value={profileData.medicalConditions}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container border border-outline-variant text-xs font-medium text-primary focus:outline-none focus:border-secondary resize-none"
                />
              </div>
            </div>
          )}

          {/* TAB 4: EMERGENCY HISTORY */}
          {activeTab === 'HISTORY' && (
            <div className="space-y-3 animate-fade-in">
              <h2 className="text-xs font-extrabold text-secondary uppercase tracking-wider flex items-center gap-1.5 border-b border-outline-variant/60 pb-2">
                <span className="material-symbols-outlined text-base">history</span>
                <span>Transmitted Emergency SOS History</span>
              </h2>

              {emergencyHistory.length === 0 ? (
                <div className="p-6 text-center text-on-surface-variant text-xs font-medium bg-surface-container/50 rounded-xl border border-outline-variant/40">
                  No emergency reports found.
                </div>
              ) : (
                emergencyHistory.map((item) => (
                  <div key={item.sosId || item.packetId} className="p-3 rounded-xl bg-surface-container border border-outline-variant flex items-center justify-between gap-2 min-w-0">
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-extrabold text-primary text-xs truncate">{item.priority || 'EMERGENCY'}</span>
                        <span className="text-[10px] font-mono text-on-surface-variant shrink-0">{item.sosId || item.packetId}</span>
                      </div>
                      <p className="text-[10px] text-on-surface-variant truncate">{item.timestamp ? new Date(item.timestamp).toLocaleString() : 'Date N/A'} • {item.address || (item.latitude ? `${item.latitude}, ${item.longitude}` : 'Location unavailable')}</p>
                    </div>
                    <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-md border shrink-0 bg-secondary/15 border-secondary text-secondary">
                      {item.deliveryStatus || 'QUEUED'}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Save Profile Button */}
          {activeTab !== 'HISTORY' && (
            <Button
              variant="primary"
              size="full"
              type="submit"
              loading={isSaving}
              className="min-h-[48px] font-extrabold text-xs"
            >
              Save Profile Modifications
            </Button>
          )}
        </form>

        {/* Sign Out Button */}
        <div className="pt-3 border-t border-outline-variant/60">
          <Button
            variant="secondary"
            size="full"
            onClick={logoutCitizen}
            className="text-error border-error/30 hover:bg-error/10 min-h-[44px]"
          >
            Sign Out of Citizen Account
          </Button>
        </div>
      </Card>
    </div>
  );
}
