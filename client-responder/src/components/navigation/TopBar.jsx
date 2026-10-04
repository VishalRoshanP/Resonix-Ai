import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { RESPONDER_ROUTES } from '../../constants/routes';
import { useLanguage } from '../../contexts/LanguageContext';
import Button from '../ui/Button';

export default function TopBar({ onToggleMobileMenu }) {
  const { responderUser, role, logout } = useAuth();
  const { currentLanguage, activeLanguageObj, supportedLanguages, selectLanguage, t } = useLanguage();
  const navigate = useNavigate();

  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setLangDropdownOpen(false);
      }
    }
    if (langDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [langDropdownOpen]);

  const handleLogout = async () => {
    await logout();
    navigate(RESPONDER_ROUTES.LOGIN);
  };

  const priorityLangs = supportedLanguages.filter((l) => l.isPriority);
  const otherLangs = supportedLanguages.filter((l) => !l.isPriority);

  return (
    <header className="shrink-0 sticky top-0 bg-surface/95 backdrop-blur-md border-b border-outline-variant/60 py-3.5 px-4 sm:px-6 flex justify-between items-center z-30">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className="p-1 text-on-surface-variant hover:text-primary md:hidden cursor-pointer"
          title="Toggle Navigation Menu"
        >
          <span className="material-symbols-outlined text-2xl">menu</span>
        </button>

        <span className="text-xs font-bold text-secondary uppercase tracking-wider hidden sm:inline-block">Protected Portal</span>
        <span className="text-xs font-mono text-on-surface-variant bg-surface-container px-2.5 py-1 rounded-md border border-outline-variant/60">
          Role: {role}
        </span>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {/* Simple Multilingual Language Selector */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setLangDropdownOpen((prev) => !prev)}
            title="Change Interface Language"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high border border-outline-variant/70 text-xs font-bold text-primary transition-all cursor-pointer shadow-2xs"
            aria-label="Language Selector"
            aria-expanded={langDropdownOpen}
          >
            <span className="text-sm">🌐</span>
            <span className="font-extrabold tracking-wide">{activeLanguageObj.short || activeLanguageObj.nativeName}</span>
            <span className="material-symbols-outlined text-sm text-on-surface-variant transition-transform duration-200">
              {langDropdownOpen ? 'expand_less' : 'expand_more'}
            </span>
          </button>

          {/* Dropdown Menu */}
          {langDropdownOpen && (
            <div className="absolute right-0 mt-1.5 w-56 rounded-xl bg-surface border border-outline-variant shadow-xl z-50 p-2 animate-fade-in text-left">
              <div className="px-2 py-1 border-b border-outline-variant/40 mb-1 flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-secondary uppercase tracking-wider">
                  Select Language
                </span>
                <span className="text-[10px] font-mono text-on-surface-variant">
                  {supportedLanguages.length} Active
                </span>
              </div>

              {/* Prioritized: English, Tamil, Hindi */}
              <div className="space-y-0.5">
                {priorityLangs.map((lang) => {
                  const isSelected = lang.code === currentLanguage;
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => {
                        selectLanguage(lang.code);
                        setLangDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-secondary text-white font-bold'
                          : 'text-primary hover:bg-surface-container'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{lang.nativeName}</span>
                        <span className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-on-surface-variant'}`}>
                          ({lang.name})
                        </span>
                      </div>
                      <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-surface-container text-on-surface-variant'
                      }`}>
                        {lang.short}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Other Supported Indian Regional Languages */}
              <div className="my-1.5 border-t border-outline-variant/40 pt-1.5">
                <span className="px-2 text-[9px] font-mono uppercase text-on-surface-variant/80 tracking-wider block mb-1">
                  Other Supported Languages
                </span>
                <div className="max-h-48 overflow-y-auto space-y-0.5 pr-0.5">
                  {otherLangs.map((lang) => {
                    const isSelected = lang.code === currentLanguage;
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => {
                          selectLanguage(lang.code);
                          setLangDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-secondary text-white font-bold'
                            : 'text-primary hover:bg-surface-container'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{lang.nativeName}</span>
                          <span className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-on-surface-variant'}`}>
                            ({lang.name})
                          </span>
                        </div>
                        <span className={`font-mono text-[9px] px-1 py-0.2 rounded ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-surface-container text-on-surface-variant'
                        }`}>
                          {lang.short}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="text-right hidden sm:block">
          <p className="text-xs font-bold text-primary">{responderUser?.name || 'Commander Reyes'}</p>
          <p className="text-[10px] text-on-surface-variant">{responderUser?.email}</p>
        </div>

        <Button variant="secondary" size="sm" icon="logout" onClick={handleLogout} className="min-h-[36px]">
          {t('btn_sign_out', 'Sign Out')}
        </Button>
      </div>
    </header>
  );
}


