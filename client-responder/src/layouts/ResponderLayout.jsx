import { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import Sidebar from '../components/navigation/Sidebar';
import TopBar from '../components/navigation/TopBar';
import { RESPONDER_ROUTES } from '../constants/routes';

export default function ResponderLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const MOBILE_NAV = [
    { label: 'Dashboard', icon: 'dashboard', path: RESPONDER_ROUTES.DASHBOARD },
    { label: 'Incidents', icon: 'warning', path: RESPONDER_ROUTES.INCIDENTS },
    { label: 'Fleet', icon: 'alt_route', path: RESPONDER_ROUTES.RESOURCES },
    { label: 'Settings', icon: 'settings', path: RESPONDER_ROUTES.SETTINGS },
  ];

  return (
    <div className="h-screen h-[100dvh] overflow-hidden flex bg-background">
      {/* Desktop & Mobile Responsive Sidebar */}
      <Sidebar
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 flex flex-col h-screen h-[100dvh] min-w-0 overflow-hidden md:ml-64">
        <TopBar onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)} />

        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-20 md:pb-8 overscroll-contain">
          <div className="max-w-[1280px] mx-auto animate-fade-in">
            <Outlet />
          </div>
        </div>

        {/* Mobile Bottom Navigation Bar (Requirement: Mobile bottom navigation or compact menu) */}
        <nav
          aria-label="Mobile Bottom Navigation"
          className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-surface-container-low/95 backdrop-blur-md border-t border-outline-variant/80 px-2 py-1.5 flex items-center justify-around"
        >
          {MOBILE_NAV.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[10px] font-bold transition-colors ${
                  isActive
                    ? 'text-secondary font-black'
                    : 'text-on-surface-variant hover:text-primary'
                }`
              }
            >
              <span className="material-symbols-outlined text-xl mb-0.5">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </main>
    </div>
  );
}


