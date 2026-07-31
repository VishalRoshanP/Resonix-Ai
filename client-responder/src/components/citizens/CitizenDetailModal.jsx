import { useState } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';

export default function CitizenDetailModal({ citizen, isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('PROFILE'); // 'PROFILE' | 'TIMELINE' | 'REPORTS' | 'CONTACTS' | 'COMMS'

  if (!isOpen || !citizen) return null;

  // Mock Incident Timeline
  const INCIDENT_TIMELINE = [
    { id: 'INC-2026-0894', date: '2026-07-29 17:15', category: 'FLOOD', status: 'DISPATCHED', location: 'Sector 4, Koramangala' },
    { id: 'INC-2026-0612', date: '2026-05-14 08:30', category: 'MEDICAL', status: 'RESOLVED', location: 'East Highway Crossing' },
  ];

  // Mock Previous Reports
  const PREVIOUS_REPORTS = [
    { id: 'rpt_101', type: 'VOICE_TELEMETRY', duration: '14s', date: '2026-07-29 17:15', text: 'Water levels rising rapidly up to 1.5m near dwelling.' },
    { id: 'rpt_102', type: 'PHOTO_ATTACHMENT', size: '142 KB', date: '2026-07-29 17:16', text: 'Disaster scene photo captured showing inundated street.' },
  ];

  // Mock Communication History
  const COMMS_HISTORY = [
    { id: 'sms_1', date: '17:18', type: 'OUTGOING_SMS', text: 'NDRF Rescue Boat #4 dispatched to your location. ETA 8 mins.' },
    { id: 'call_1', date: '17:20', type: 'VOICE_CALL', text: 'Dispatcher Miller confirmed target location with citizen.' },
  ];

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-left overflow-y-auto">
      <Card className="bg-surface border border-outline-variant max-w-2xl w-full p-6 space-y-4 shadow-2xl my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-outline-variant/60 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-secondary/15 border-2 border-secondary overflow-hidden flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-2xl">
                {citizen.isGuest ? 'account_circle' : 'person'}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-primary leading-none">{citizen.name}</h2>
                <span
                  className={`text-[9px] font-mono font-extrabold px-2 py-0.5 rounded-md ${
                    citizen.isGuest ? 'bg-amber-500/15 border-amber-500 text-amber-500' : 'bg-success/15 border-success text-success'
                  }`}
                >
                  {citizen.isGuest ? 'GUEST USER' : 'REGISTERED CITIZEN'}
                </span>
              </div>
              <p className="text-[10px] text-on-surface-variant font-mono mt-0.5">
                ID: {citizen.id} • Registered: {citizen.registeredDate || 'Temporary Session'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-on-surface-variant hover:text-primary rounded-lg cursor-pointer">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Multi-Tab Navigation Header */}
        <div className="grid grid-cols-5 gap-1 p-1 bg-surface-container rounded-xl border border-outline-variant text-[10px] font-bold text-center">
          <button
            onClick={() => setActiveTab('PROFILE')}
            className={`py-2 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'PROFILE' ? 'bg-secondary text-white shadow-xs' : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            Profile & Medical
          </button>
          <button
            onClick={() => setActiveTab('TIMELINE')}
            className={`py-2 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'TIMELINE' ? 'bg-secondary text-white shadow-xs' : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            Timeline
          </button>
          <button
            onClick={() => setActiveTab('REPORTS')}
            className={`py-2 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'REPORTS' ? 'bg-secondary text-white shadow-xs' : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            Reports
          </button>
          <button
            onClick={() => setActiveTab('CONTACTS')}
            className={`py-2 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'CONTACTS' ? 'bg-secondary text-white shadow-xs' : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            Contacts
          </button>
          <button
            onClick={() => setActiveTab('COMMS')}
            className={`py-2 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'COMMS' ? 'bg-secondary text-white shadow-xs' : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            Comms Log
          </button>
        </div>

        {/* Tab 1: Profile & Medical Notes */}
        {activeTab === 'PROFILE' && (
          <div className="space-y-4 text-xs animate-fade-in">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-surface-container border border-outline-variant space-y-1">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Phone Contact</span>
                <p className="font-mono text-primary font-bold">{citizen.phone || 'N/A (Guest Session)'}</p>
              </div>

              <div className="p-3 rounded-xl bg-surface-container border border-outline-variant space-y-1">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Email Address</span>
                <p className="font-mono text-primary font-bold truncate">{citizen.email || 'guest@resonix.gov'}</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-secondary/10 border border-secondary/30 space-y-2">
              <h3 className="text-xs font-extrabold text-secondary uppercase tracking-wider flex items-center gap-1.5 border-b border-secondary/20 pb-1.5">
                <span className="material-symbols-outlined text-base">medical_services</span>
                <span>Medical Profile & Alert Notes</span>
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-on-surface-variant font-bold block uppercase">Blood Group</span>
                  <span className="font-mono font-extrabold text-error bg-error/15 px-2 py-0.5 rounded border border-error/30 inline-block mt-0.5">
                    {citizen.bloodGroup || 'O+'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-on-surface-variant font-bold block uppercase">Preferred Language</span>
                  <span className="font-bold text-primary block mt-0.5">{citizen.language || 'English'}</span>
                </div>
              </div>

              <div className="pt-1">
                <span className="text-[10px] text-on-surface-variant font-bold block uppercase">Medical Conditions & Allergies</span>
                <p className="text-primary font-medium mt-0.5">{citizen.medicalConditions || 'Mild Asthma, Penicillin Allergy. Requires oxygen check upon rescue.'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Incident Timeline */}
        {activeTab === 'TIMELINE' && (
          <div className="space-y-3 text-xs animate-fade-in">
            <h3 className="text-xs font-extrabold text-primary uppercase tracking-wider border-b border-outline-variant/60 pb-2">
              Emergency SOS Incident History
            </h3>
            <div className="space-y-2">
              {INCIDENT_TIMELINE.map((inc) => (
                <div key={inc.id} className="p-3 rounded-xl bg-surface-container border border-outline-variant flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-extrabold text-secondary">{inc.id}</span>
                      <span className="font-extrabold text-primary">{inc.category}</span>
                    </div>
                    <p className="text-[10px] text-on-surface-variant mt-0.5">{inc.date} • {inc.location}</p>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-secondary/15 text-secondary border border-secondary/30">
                    {inc.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Previous Reports */}
        {activeTab === 'REPORTS' && (
          <div className="space-y-3 text-xs animate-fade-in">
            <h3 className="text-xs font-extrabold text-primary uppercase tracking-wider border-b border-outline-variant/60 pb-2">
              Submitted Voice & Photo Telemetry Reports
            </h3>
            <div className="space-y-2">
              {PREVIOUS_REPORTS.map((rpt) => (
                <div key={rpt.id} className="p-3 rounded-xl bg-surface-container border border-outline-variant space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="font-bold text-secondary">{rpt.type}</span>
                    <span className="text-on-surface-variant">{rpt.date}</span>
                  </div>
                  <p className="text-primary font-medium">{rpt.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: Emergency Contacts */}
        {activeTab === 'CONTACTS' && (
          <div className="space-y-3 text-xs animate-fade-in">
            <h3 className="text-xs font-extrabold text-primary uppercase tracking-wider border-b border-outline-variant/60 pb-2">
              Registered Emergency Contacts
            </h3>
            <div className="space-y-2">
              <div className="p-3 rounded-xl bg-surface-container border border-outline-variant flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-secondary uppercase block">Primary Emergency Contact</span>
                  <p className="font-extrabold text-primary text-xs">{citizen.emergencyContactName || 'Mary Johnson (Mother)'}</p>
                  <p className="font-mono text-on-surface-variant text-[11px]">{citizen.emergencyContactPhone || '+91 98765 00000'}</p>
                </div>
                <a
                  href={`tel:${citizen.emergencyContactPhone || '+919876500000'}`}
                  className="px-3 py-1.5 rounded-lg bg-secondary/15 border border-secondary/30 text-secondary font-bold text-xs flex items-center gap-1 cursor-pointer hover:bg-secondary/25"
                >
                  <span className="material-symbols-outlined text-sm">call</span>
                  <span>Call</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Communication Log */}
        {activeTab === 'COMMS' && (
          <div className="space-y-3 text-xs animate-fade-in">
            <h3 className="text-xs font-extrabold text-primary uppercase tracking-wider border-b border-outline-variant/60 pb-2">
              Dispatcher Communication Log
            </h3>
            <div className="space-y-2">
              {COMMS_HISTORY.map((c) => (
                <div key={c.id} className="p-3 rounded-xl bg-surface-container border border-outline-variant space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="font-bold text-secondary">{c.type}</span>
                    <span className="text-on-surface-variant">{c.date}</span>
                  </div>
                  <p className="text-primary font-medium">{c.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="pt-3 border-t border-outline-variant/60 flex justify-end">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close Inspection
          </Button>
        </div>
      </Card>
    </div>
  );
}
