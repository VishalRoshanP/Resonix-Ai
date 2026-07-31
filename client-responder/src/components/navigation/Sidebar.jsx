import { NavLink } from 'react-router-dom';
import { RESPONDER_ROUTES } from '../../constants/routes';
import { cn } from '../../utils/helpers';

export default function Sidebar({ mobileOpen = false, onCloseMobile }) {
  // 5 Streamlined Essential Navigation Items for Emergency Responders
  const NAV_ITEMS = [
    { label: 'Dashboard', icon: 'dashboard', path: RESPONDER_ROUTES.DASHBOARD },
    { label: 'Incidents', icon: 'warning', path: RESPONDER_ROUTES.INCIDENTS },
    { label: 'Resources', icon: 'alt_route', path: RESPONDER_ROUTES.RESOURCES },
    { label: 'Analytics', icon: 'analytics', path: RESPONDER_ROUTES.ANALYTICS },
    { label: 'Settings', icon: 'settings', path: RESPONDER_ROUTES.SETTINGS },
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
          'w-64 bg-surface-container-low border-r border-outline-variant py-6 px-4 flex flex-col justify-between shrink-0 h-screen sticky top-0 z-50 transition-transform duration-300 md:translate-x-0',
          mobileOpen ? 'fixed left-0 top-0 translate-x-0' : 'hidden md:flex'
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
                    'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border-l-4 min-h-[44px]',
                    isActive
                      ? 'bg-primary text-white border-secondary font-bold shadow-xs'
                      : 'text-on-surface-variant border-transparent hover:bg-surface-container-high hover:text-primary'
                  )
                }
              >
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                <span>{item.label}</span>
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
