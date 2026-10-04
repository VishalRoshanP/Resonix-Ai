import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../contexts/PermissionContext';
import { ROUTES } from '../constants/routes';
import Button from '../components/ui/Button';

export default function PermissionSetupPage() {
  const navigate = useNavigate();
  const { permissionsState, requestPermissionById, requestAllPermissions, completePermissionSetup, configs } = usePermissions();
  const [loadingMap, setLoadingMap] = useState({});

  const handleRequestOne = async (id) => {
    setLoadingMap((prev) => ({ ...prev, [id]: true }));
    await requestPermissionById(id);
    setLoadingMap((prev) => ({ ...prev, [id]: false }));
  };

  const handleRequestAll = async () => {
    setLoadingMap({ microphone: true, camera: true, location: true, notifications: true, nearbyDevices: true });
    await requestAllPermissions();
    setLoadingMap({});
  };

  const handleContinue = () => {
    completePermissionSetup();
    navigate(ROUTES.CITIZEN_HOME);
  };

  const countGranted = Object.values(permissionsState).filter((s) => s === 'granted').length;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 animate-fade-in">
      <div className="w-full max-w-3xl bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 sm:p-8 md:p-10 shadow-ambient">
        {/* Branding Header */}
        <div className="text-center mb-8 pb-6 border-b border-outline-variant/60">
          <div className="w-16 h-16 bg-secondary/10 border border-secondary/20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <span className="material-symbols-outlined text-secondary text-3xl">
              security
            </span>
          </div>

          <h1 className="text-display-sm sm:text-display-md font-bold text-primary tracking-tight">
            RESONIX AI
          </h1>
          <p className="text-sm font-semibold text-secondary flex items-center justify-center gap-1.5 mt-1">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
            Emergency intelligence and response support
          </p>
          <p className="text-body-sm text-on-surface-variant mt-3 max-w-lg mx-auto">
            Configure system permissions to enable full offline intelligence, voice dispatching, and emergency mesh communication.
          </p>
        </div>

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 p-4 bg-surface-container/40 rounded-xl border border-outline-variant/60">
          <div className="text-xs sm:text-sm text-on-surface-variant">
            Status: <span className="font-bold text-primary">{countGranted} of {configs.length}</span> permissions granted
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleRequestAll}
            className="w-full sm:w-auto"
          >
            Grant All Permissions
          </Button>
        </div>

        {/* Permission List */}
        <div className="space-y-4 mb-8">
          {configs.map((cfg) => {
            const status = permissionsState[cfg.id] || 'prompt';
            const isLoading = loadingMap[cfg.id];

            return (
              <div
                key={cfg.id}
                className="p-4 sm:p-5 bg-surface-container/30 border border-outline-variant rounded-xl transition-all hover:bg-surface-container/60"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-secondary/10 border border-secondary/20 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-secondary text-xl">
                        {cfg.icon}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-primary text-base">{cfg.title}</h3>
                        {/* Status Badge */}
                        {status === 'granted' && (
                          <span className="px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                            Granted
                          </span>
                        )}
                        {status === 'denied' && (
                          <span className="px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider bg-amber-500/10 border border-amber-500/30 text-amber-400">
                            Denied (Limited)
                          </span>
                        )}
                        {status === 'prompt' && (
                          <span className="px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider bg-secondary/10 border border-secondary/30 text-secondary">
                            Pending
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                        {cfg.requiredReason}
                      </p>

                      {status === 'denied' && (
                        <p className="text-2xs font-medium text-amber-400/90 mt-2 flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">info</span>
                          {cfg.limitationIfDenied}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Allow Button */}
                  <div className="shrink-0 self-end sm:self-center">
                    {status === 'granted' ? (
                      <div className="flex items-center gap-1 text-emerald-400 text-sm font-semibold px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <span className="material-symbols-outlined text-base">check_circle</span>
                        Active
                      </div>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleRequestOne(cfg.id)}
                        disabled={isLoading}
                      >
                        {isLoading ? 'Requesting...' : status === 'denied' ? 'Re-try Access' : 'Allow Access'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-outline-variant/60">
          <p className="text-2xs sm:text-xs text-on-surface-variant">
            Emergency reporting remains accessible even if some permissions are disabled.
          </p>

          <Button
            variant="primary"
            size="lg"
            onClick={handleContinue}
            className="w-full sm:w-auto px-8"
          >
            Continue to Citizen Portal →
          </Button>
        </div>
      </div>
    </div>
  );
}
