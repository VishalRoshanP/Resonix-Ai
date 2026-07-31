import Card from '../components/ui/Card';

export default function ResponderDashboardPage() {
  return (
    <div className="space-y-6 text-left animate-fade-in">
      <div className="border-b border-outline-variant/60 pb-4">
        <h1 className="text-headline-lg font-extrabold text-primary">Responder Dashboard</h1>
        <p className="text-body-md text-on-surface-variant mt-0.5">Command Center Operations Placeholder</p>
      </div>

      <Card className="p-8 text-center space-y-3 bg-surface-container-low border-dashed border-2 border-outline-variant">
        <div className="w-12 h-12 rounded-2xl bg-secondary/10 border border-secondary/20 flex items-center justify-center mx-auto">
          <span className="material-symbols-outlined text-secondary text-2xl">dashboard</span>
        </div>
        <h2 className="text-xl font-bold text-primary">Responder Dashboard Shell Ready</h2>
        <p className="text-xs text-on-surface-variant max-w-md mx-auto">
          Dual-frontend architecture established. This application operates independently on Port 5174 and communicates with the shared Express backend (Port 5000) and MongoDB Atlas database.
        </p>
      </Card>
    </div>
  );
}
