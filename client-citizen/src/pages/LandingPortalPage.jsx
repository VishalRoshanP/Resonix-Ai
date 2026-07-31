import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

export default function LandingPortalPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between p-4 sm:p-6 lg:p-8 animate-fade-in text-left">
      {/* HEADER SECTION */}
      <header className="max-w-5xl mx-auto w-full py-6 border-b border-outline-variant/60">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-secondary/10 border border-secondary/30 flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-secondary text-3xl">psychology</span>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-primary tracking-tight leading-none">
                RESONIX AI
              </h1>
              <p className="text-xs font-semibold text-secondary flex items-center gap-1.5 mt-1">
                <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                Powered by Gemma 4
              </p>
            </div>
          </div>

          <div className="text-xs font-semibold text-on-surface-variant bg-surface-container px-3.5 py-2 rounded-xl border border-outline-variant/60 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            Offline Mesh & Local AI Operational
          </div>
        </div>

        {/* Tagline & Subtitle Banner */}
        <div className="mt-6 space-y-1">
          <h2 className="text-body-lg sm:text-headline-md font-bold text-primary">
            AI-Powered Disaster Intelligence & Emergency Response
          </h2>
          <p className="text-sm text-on-surface-variant">
            Instant Citizen SOS & Emergency Response Portal.
          </p>
        </div>
      </header>

      {/* MAIN OPTION */}
      <main className="max-w-5xl mx-auto w-full py-8 sm:py-12 space-y-12 my-auto">
        <div className="max-w-xl mx-auto">
          {/* Continue as Citizen */}
          <Card className="p-6 sm:p-8 flex flex-col justify-between border-2 border-outline-variant hover:border-secondary transition-all shadow-sm space-y-6">
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-error/10 border border-error/20 flex items-center justify-center">
                <span className="text-3xl">🚨</span>
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-extrabold text-primary flex items-center gap-2">
                  Continue as Citizen
                </h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  Report emergencies quickly using voice, photos, and location.
                </p>
              </div>
            </div>

            <Button
              variant="urgent"
              size="full"
              icon="arrow_forward"
              iconPosition="right"
              onClick={() => navigate(ROUTES.CITIZEN_HOME)}
              className="text-base font-bold py-3.5"
            >
              Continue
            </Button>
          </Card>
        </div>

        {/* FEATURE PREVIEW SECTION */}
        <div className="space-y-6 pt-4 border-t border-outline-variant/60">
          <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider text-center">
            Core Platform Capabilities
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {/* Feature 1 */}
            <div className="bg-surface-container-lowest border border-outline-variant/80 rounded-xl p-4 space-y-2">
              <div className="w-9 h-9 rounded-lg bg-secondary/10 border border-secondary/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-secondary text-xl">mic</span>
              </div>
              <h4 className="font-bold text-primary text-sm">Voice-First Emergency Reporting</h4>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Hands-free speech transcription and 1-tap emergency dispatch.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-surface-container-lowest border border-outline-variant/80 rounded-xl p-4 space-y-2">
              <div className="w-9 h-9 rounded-lg bg-secondary/10 border border-secondary/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-secondary text-xl">hub</span>
              </div>
              <h4 className="font-bold text-primary text-sm">Offline Relay Support</h4>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Seamless peer-to-peer mesh packet transmission without internet.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-surface-container-lowest border border-outline-variant/80 rounded-xl p-4 space-y-2">
              <div className="w-9 h-9 rounded-lg bg-secondary/10 border border-secondary/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-secondary text-xl">psychology</span>
              </div>
              <h4 className="font-bold text-primary text-sm">AI-Powered Incident Intelligence</h4>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Local Gemma 4 model rationale & predictive resource allocation.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="max-w-5xl mx-auto w-full py-6 border-t border-outline-variant/60 text-center space-y-1">
        <p className="text-xs font-semibold text-primary">
          Emergency reporting works even without creating an account.
        </p>
        <p className="text-xs text-on-surface-variant">
          Privacy protected. • Powered by Gemma 4.
        </p>
      </footer>
    </div>
  );
}
