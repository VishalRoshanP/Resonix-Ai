import Card from '../components/ui/Card';
export default function EmergencyGuidePage() {
  const guides = [
    { title: 'Earthquake', icon: 'earthquake', steps: ['Drop, Cover, and Hold On.', 'Stay away from windows and heavy objects.', 'Once shaking stops, check for injuries.', 'Move to open ground away from structures.', 'Report status via Resonix relay.'] },
    { title: 'Flood', icon: 'flood', steps: ['Move to higher ground immediately.', 'Do not walk through moving water.', 'If trapped, signal for help from highest point.', 'Avoid contact with flood water.', 'Use mesh relay if communications are down.'] },
    { title: 'Fire', icon: 'local_fire_department', steps: ['Evacuate the area immediately.', 'Stay low to avoid smoke inhalation.', 'Use designated evacuation routes.', 'Do not use elevators.', 'Report fire location via emergency broadcast.'] },
    { title: 'Medical Emergency', icon: 'local_hospital', steps: ['Call for help via SOS signal.', 'Apply first aid if trained.', 'Keep the patient stable and warm.', 'Note symptoms and time of onset.', 'Wait for medical responders — ETA shown in app.'] },
  ];
  return (
    <div className="space-y-6">
      <h1 className="text-headline-lg font-bold text-primary">Documentation & Emergency Guide</h1>
      <p className="text-body-md text-on-surface-variant">Documentation and step-by-step operating procedures for emergency scenarios</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {guides.map((guide, i) => (
          <Card key={i} className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-secondary">{guide.icon}</span>
              </div>
              <h3 className="text-body-lg font-bold text-primary">{guide.title}</h3>
            </div>
            <ol className="space-y-2">
              {guide.steps.map((step, j) => (
                <li key={j} className="flex gap-3 text-sm text-on-surface">
                  <span className="w-5 h-5 rounded-full bg-surface-container text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{j + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </Card>
        ))}
      </div>
    </div>
  );
}
