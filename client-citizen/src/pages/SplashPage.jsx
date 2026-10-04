import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { usePermissions } from '../contexts/PermissionContext';

export default function SplashPage() {
  const navigate = useNavigate();
  const { hasSelectedLanguage } = useLanguage();
  const { hasCompletedPermissionsSetup } = usePermissions();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            if (!hasSelectedLanguage) {
              navigate('/language-selection');
            } else if (!hasCompletedPermissionsSetup) {
              navigate('/permissions');
            } else {
              navigate('/onboarding');
            }
          }, 400);
          return 100;
        }
        return prev + 2;
      });
    }, 40);
    return () => clearInterval(interval);
  }, [navigate, hasSelectedLanguage, hasCompletedPermissionsSetup]);

  return (
    <div className="min-h-screen bg-primary flex flex-col items-center justify-center text-center p-8">
      {/* Logo Area */}
      <div className="mb-12 animate-fade-in">
        <div className="w-20 h-20 bg-secondary rounded-xl flex items-center justify-center mx-auto mb-6 shadow-ambient">
          <span className="material-symbols-outlined text-white text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            psychology
          </span>
        </div>
        <h1 className="text-display-lg text-white mb-1 tracking-tight">RESONIX AI</h1>
        <p className="text-headline-md font-semibold text-secondary tracking-wide mb-2">
          Emergency Intelligence and Response Support
        </p>
        <p className="text-label-sm uppercase tracking-[0.2em] text-primary-fixed-dim">
          Disaster Intelligence Platform
        </p>
      </div>

      {/* Loading Indicator */}
      <div className="w-48 animate-slide-up" style={{ animationDelay: '200ms' }}>
        <div className="w-full bg-tertiary-container h-1 rounded-full overflow-hidden">
          <div
            className="bg-secondary h-full rounded-full transition-all duration-200 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-label-sm text-on-primary-container mt-3">
          Initializing Emergency Intelligence Engine...
        </p>
      </div>

      {/* Version */}
      <p className="absolute bottom-8 text-label-sm text-on-primary-container opacity-50">
        v4.0.2 • Offline-First Architecture
      </p>
    </div>
  );
}
