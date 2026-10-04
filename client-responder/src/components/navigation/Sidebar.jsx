import { NavLink } from 'react-router-dom';
import { RESPONDER_ROUTES } from '../../constants/routes';
import { useLanguage } from '../../contexts/LanguageContext';
import { cn } from '../../utils/helpers';

export default function Sidebar({ mobileOpen = false, onCloseMobile }) {
  const { t } = useLanguage();

  // 5 Streamlined Essential Navigation Items for Emergency Responders
  const NAV_ITEMS = [
    { key: 'nav_dashboard', label: 'Dashboard', icon: 'dashboard', path: RESPONDER_ROUTES.DASHBOARD },
    { key: 'nav_incidents', label: 'Incidents', icon: 'warning', path: RESPONDER_ROUTES.INCIDENTS },
    { key: 'nav_resources', label: 'Resources', icon: 'alt_route', path: RESPONDER_ROUTES.RESOURCES },
    { key: 'nav_analytics', label: 'Analytics', icon: 'analytics', path: RESPONDER_ROUTES.ANALYTICS },
    { key: 'nav_settings', label: 'Settings', icon: 'settings', path: RESPONDER_ROUTES.SETTINGS },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden animate-fade-in"
        />
      )}

      <aside
        className={cn(
          'w-64 bg-surface-container-low border-r border-outline-variant py-6 px-4 flex flex-col justify-between shrink-0 h-screen h-[100dvh] overflow-y-auto overscroll-contain transition-transform duration-300 fixed top-0 left-0 bottom-0 z-40 md:translate-x-0',
          mobileOpen ? 'translate-x-0 z-50 flex' : '-translate-x-full md:translate-x-0 hidden md:flex'
        )}
      >
        <div className="space-y-6">
          {/* Brand */}
          <div className="px-2 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-primary tracking-tight">RESONIX AI</h2>
              <p className="text-[11px] font-bold text-secondary flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                Responder Command Center
              </p>
            </div>
            {mobileOpen && (
              <button
                onClick={onCloseMobile}
                className="p-1 text-on-surface-variant hover:text-primary md:hidden cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            )}
          </div>

          {/* Links */}
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  cn(
                    'sidebar-nav-item flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all border-l-4 min-h-[44px]',
                    isActive
                      ? 'active shadow-xs !text-white text-white font-extrabold'
                      : 'text-on-surface-variant font-medium'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        'material-symbols-outlined text-[20px] shrink-0 transition-colors',
                        isActive ? '!text-white text-white' : 'text-on-surface-variant'
                      )}
                    >
                      {item.icon}
                    </span>
                    <span
                      className={cn(
                        'truncate transition-colors',
                        isActive ? '!text-white text-white font-extrabold' : 'text-on-surface-variant'
                      )}
                    >
                      {t(item.key, item.label)}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Footer Info */}
        <div className="px-2 text-[10px] text-on-surface-variant font-mono">
          Port 5174 • Responder Command Center
        </div>
      </aside>
    </>
  );
}
