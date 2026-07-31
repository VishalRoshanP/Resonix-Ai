import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import Button from '../components/ui/Button';

export default function LanguageSelectionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentLanguage, supportedLanguages, selectLanguage, hasSelectedLanguage } = useLanguage();

  // Selected language state within component
  const [selected, setSelected] = useState(currentLanguage || 'en');

  // If language already selected and not forced via query param, auto-skip on mount
  const isForced = searchParams.get('force') === 'true';

  const handleConfirm = async () => {
    await selectLanguage(selected);
    navigate('/permissions');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 animate-fade-in">
      <div className="w-full max-w-2xl bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 sm:p-8 md:p-10 shadow-ambient text-center">
        {/* Branding Header */}
        <div className="mb-8 pb-6 border-b border-outline-variant/60">
          <div className="w-16 h-16 bg-secondary/10 border border-secondary/20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <span className="material-symbols-outlined text-secondary text-3xl">
              language
            </span>
          </div>
          
          <h1 className="text-display-sm sm:text-display-md font-bold text-primary tracking-tight">
            RESONIX AI
          </h1>
          <p className="text-sm font-semibold text-secondary flex items-center justify-center gap-1.5 mt-1">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
            Powered by Gemma 4
          </p>
          <p className="text-body-sm text-on-surface-variant mt-3 max-w-md mx-auto">
            Select your preferred operational language for emergency dispatches, voice synthesis, and real-time intelligence.
          </p>
        </div>

        {/* Language Options Grid - 1 Col Mobile, 2 Cols Tablet/Desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-8 text-left">
          {supportedLanguages.map((lang) => {
            const isSelected = selected === lang.code;

            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => setSelected(lang.code)}
                className={`relative flex items-center justify-between p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'bg-secondary/10 border-secondary ring-1 ring-secondary/50 shadow-md'
                    : 'bg-surface-container/50 border-outline-variant hover:bg-surface-container hover:border-outline'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{lang.flag}</span>
                  <div>
                    <div className="font-bold text-primary text-base sm:text-lg">
                      {lang.nativeName}
                    </div>
                    <div className="text-xs text-on-surface-variant font-medium">
                      {lang.name} • {lang.script}
                    </div>
                  </div>
                </div>

                {/* Radio selection checkmark indicator */}
                <div
                  className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all ${
                    isSelected
                      ? 'bg-secondary border-secondary text-white'
                      : 'border-outline-variant bg-surface'
                  }`}
                >
                  {isSelected && (
                    <span className="material-symbols-outlined text-sm font-bold">
                      check
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-outline-variant/60">
          <span className="text-xs text-on-surface-variant font-medium">
            Single language selection • Can be changed in settings
          </span>

          <Button
            variant="primary"
            size="lg"
            onClick={handleConfirm}
            className="w-full sm:w-auto px-8"
          >
            Confirm & Continue →
          </Button>
        </div>
      </div>
    </div>
  );
}
