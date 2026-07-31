import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import ProgressBar from '../components/ui/ProgressBar';
import Button from '../components/ui/Button';

export default function PersonnelDataPage() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" icon="arrow_back" onClick={() => navigate('/personnel')}>
          Back to Personnel
        </Button>
      </div>
      <div>
        <h1 className="text-headline-lg font-bold text-primary">Personnel Biometric Data</h1>
        <p className="text-body-md text-on-surface-variant mt-1">Live biometric pulses & health monitoring</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          { name: 'Sgt. Maria Chen', hr: 82, temp: 98.6, o2: 97, stress: 'low' },
          { name: 'Lt. James Walker', hr: 91, temp: 99.1, o2: 96, stress: 'moderate' },
          { name: 'Cpl. Aisha Patel', hr: 76, temp: 98.4, o2: 98, stress: 'low' },
          { name: 'Pvt. Derek Yamamoto', hr: null, temp: null, o2: null, stress: 'offline' },
        ].map((p, i) => (
          <Card key={i} className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-surface-variant border border-outline-variant flex items-center justify-center">
                <span className="material-symbols-outlined text-on-surface-variant">person</span>
              </div>
              <div>
                <h4 className="font-bold text-primary">{p.name}</h4>
                <span className={`text-label-sm uppercase ${p.stress === 'low' ? 'text-success' : p.stress === 'moderate' ? 'text-secondary' : 'text-outline'}`}>
                  {p.stress === 'offline' ? 'Signal Lost' : `Stress: ${p.stress}`}
                </span>
              </div>
            </div>
            {p.hr ? (
              <div className="grid grid-cols-3 gap-4">
                <div><p className="text-label-sm uppercase text-on-surface-variant">Heart Rate</p><p className="text-xl font-bold font-mono text-primary flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse" />{p.hr}</p></div>
                <div><p className="text-label-sm uppercase text-on-surface-variant">Temp</p><p className="text-xl font-bold font-mono text-primary">{p.temp}°F</p></div>
                <div><p className="text-label-sm uppercase text-on-surface-variant">O₂ Sat</p><p className="text-xl font-bold font-mono text-primary">{p.o2}%</p><ProgressBar value={p.o2} variant="success" className="mt-1" /></div>
              </div>
            ) : (
              <div className="text-center py-6 text-on-surface-variant">
                <span className="material-symbols-outlined text-3xl opacity-30">signal_disconnected</span>
                <p className="text-sm mt-2">No biometric data available</p>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
