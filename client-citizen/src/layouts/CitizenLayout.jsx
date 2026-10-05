import { Outlet, useNavigate, useLocation, NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ROUTES } from '../constants/routes';
import { useLanguage } from '../contexts/LanguageContext';
import NetworkStatusWidget from '../components/network/NetworkStatusWidget';
import LocationDetectorWidget from '../components/location/LocationDetectorWidget';

export default function CitizenLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { citizenUser, isCitizenGuest } = useAuth();
  const { activeLanguageObj } = useLanguage();

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      {/* Top Citizen Header */}
      <header className="sticky top-0 w-full bg-surface/95 backdrop-blur-md border-b border-outline-variant/60 z-30">
        <div className="max-w-md sm:max-w-lg mx-auto flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3">
          {/* Logo / Title */}
          <button
            onClick={() => navigate(ROUTES.CITIZEN_HOME)}
            className="flex items-center gap-2 cursor-pointer group text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-secondary/10 border border-secondary/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-secondary text-lg">psychology</span>
            </div>
            <div>
              <span className="font-bold text-primary text-sm tracking-tight block leading-none">RESONIX AI</span>
              <span className="text-[10px] text-secondary font-semibold">Citizen Emergency</span>
            </div>
          </button>

          {/* Auth & Guest Status Pill */}
          <div className="flex items-center gap-2">
            {isCitizenGuest ? (
              <button
                onClick={() => navigate(ROUTES.CITIZEN_LOGIN)}
                className="text-[11px] font-bold text-primary bg-surface-container px-2.5 py-1 rounded-full border border-outline-variant/60 hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                Sign In
              </button>
            ) : (
              <div className="text-[11px] font-bold text-success bg-success/10 px-2.5 py-1 rounded-full border border-success/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                <span className="max-w-[110px] truncate">{citizenUser?.name || 'Citizen User'}</span>
              </div>
            )}

            {/* Citizen Home */}
            <button
              onClick={() => navigate(ROUTES.CITIZEN_HOME)}
              className="p-1.5 text-on-surface-variant hover:text-primary rounded-lg hover:bg-surface-container transition-colors cursor-pointer"
              title="Return to Citizen Emergency Home"
            >
              <span className="material-symbols-outlined text-lg">home</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-md sm:max-w-lg mx-auto p-2.5 sm:p-4 animate-fade-in overflow-x-hidden">
        <Outlet />
      </main>

      {/* Footer Shortcut Bar */}
      <footer className="sticky bottom-0 w-full bg-surface/95 backdrop-blur-md border-t border-outline-variant/60 py-1.5 sm:py-2.5 px-1 sm:px-3 z-20 pb-safe">
        <div className="max-w-md sm:max-w-lg mx-auto flex justify-between items-center text-xs">
          <NavLink
            to={ROUTES.CITIZEN_HOME}
            className={({ isActive }) =>
              `flex items-center gap-0.5 sm:gap-1 font-bold px-1.5 sm:px-3 py-1.5 sm:py-2 min-h-[44px] rounded-xl text-[11px] sm:text-xs transition-colors cursor-pointer ${
                isActive ? 'bg-secondary text-white shadow-xs' : 'text-on-surface-variant hover:text-primary'
              }`
            }
          >
            <span className="material-symbols-outlined text-base">home</span>
            <span>Home</span>
          </NavLink>

          <NavLink
            to={ROUTES.CITIZEN_SOS}
            className={({ isActive }) =>
              `flex items-center gap-0.5 sm:gap-1 font-bold px-1.5 sm:px-3 py-1.5 sm:py-2 min-h-[44px] rounded-xl text-[11px] sm:text-xs transition-colors cursor-pointer ${
                isActive ? 'bg-error text-white shadow-xs shadow-error/30' : 'text-error font-extrabold hover:bg-error/10'
              }`
            }
          >
            <span className="material-symbols-outlined text-base">emergency</span>
            <span>SOS</span>
          </NavLink>

          <NavLink
            to={ROUTES.CITIZEN_STATUS}
            className={({ isActive }) =>
              `flex items-center gap-0.5 sm:gap-1 font-bold px-1.5 sm:px-3 py-1.5 sm:py-2 min-h-[44px] rounded-xl text-[11px] sm:text-xs transition-colors cursor-pointer ${
                isActive ? 'bg-secondary text-white shadow-xs' : 'text-on-surface-variant hover:text-primary'
              }`
            }
          >
            <span className="material-symbols-outlined text-base">history</span>
            <span>Status</span>
          </NavLink>

          <NavLink
            to={ROUTES.CITIZEN_PROFILE}
            className={({ isActive }) =>
              `flex items-center gap-0.5 sm:gap-1 font-bold px-1.5 sm:px-3 py-1.5 sm:py-2 min-h-[44px] rounded-xl text-[11px] sm:text-xs transition-colors cursor-pointer ${
                isActive ? 'bg-secondary text-white shadow-xs' : 'text-on-surface-variant hover:text-primary'
              }`
            }
          >
            <span className="material-symbols-outlined text-base">person</span>
            <span>Profile</span>
          </NavLink>

          <NavLink
            to={ROUTES.CITIZEN_SETTINGS}
            className={({ isActive }) =>
              `flex items-center gap-0.5 sm:gap-1 font-bold px-1.5 sm:px-3 py-1.5 sm:py-2 min-h-[44px] rounded-xl text-[11px] sm:text-xs transition-colors cursor-pointer ${
                isActive ? 'bg-secondary text-white shadow-xs' : 'text-on-surface-variant hover:text-primary'
              }`
            }
          >
            <span className="material-symbols-outlined text-base">settings</span>
            <span>Settings</span>
          </NavLink>
        </div>
      </footer>
    </div>
  );
}
