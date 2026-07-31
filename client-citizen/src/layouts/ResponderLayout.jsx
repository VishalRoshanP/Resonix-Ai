import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ROUTES } from '../constants/routes';
import { cn } from '../utils/helpers';
import Avatar from '../components/ui/Avatar';
import StatusChip from '../components/ui/StatusChip';

export default function ResponderLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { responderUser, responderRole, logoutResponder } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const RESPONDER_NAV_ITEMS = [
    { label: 'Dashboard', icon: 'dashboard', path: ROUTES.RESPONDER_DASHBOARD },
    { label: 'Incidents', icon: 'warning', path: ROUTES.RESPONDER_INCIDENTS },
    { label: 'Citizens', icon: 'groups', path: ROUTES.RESPONDER_CITIZENS },
    { label: 'Reports', icon: 'description', path: ROUTES.RESPONDER_REPORTS },
    { label: 'Analytics', icon: 'analytics', path: ROUTES.RESPONDER_ANALYTICS },
    { label: 'Organizations', icon: 'corporate_fare', path: ROUTES.RESPONDER_ORGANIZATIONS },
    { label: 'Users', icon: 'badge', path: ROUTES.RESPONDER_USERS },
    { label: 'Audit Logs', icon: 'security', path: ROUTES.RESPONDER_AUDIT_LOGS },
    { label: 'Settings', icon: 'settings', path: ROUTES.RESPONDER_SETTINGS },
    { label: 'Account', icon: 'account_circle', path: ROUTES.RESPONDER_ACCOUNT },
  ];

  const handleLogout = async () => {
    await logoutResponder();
    navigate(ROUTES.RESPONDER_LOGIN);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full py-6 bg-surface-container-low border-r border-outline-variant w-64 shrink-0">
      {/* Brand Header */}
      <div className="px-6 mb-6 flex justify-between items-start">
        <div>
          <h2 className="text-headline-md font-extrabold text-primary tracking-tight">RESONIX AI</h2>
          <p className="text-xs font-semibold text-secondary flex items-center gap-1.5 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
            Responder Command Center
          </p>
          <div className="mt-2.5">
            <StatusChip
              label={responderRole}
              variant={responderRole === 'Administrator' ? 'critical' : responderRole === 'Coordinator' ? 'warning' : 'info'}
              dot
            />
          </div>
        </div>

        <button
          onClick={() => setIsMobileOpen(false)}
          className="md:hidden p-1.5 text-on-surface-variant hover:text-primary rounded-lg cursor-pointer"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>
      </div>

      {/* Nav Items */}
      <ul className="flex-1 px-4 space-y-1 overflow-y-auto">
        {RESPONDER_NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;

          return (
            <li key={item.path}>
              <NavLink
                to={item.path}
                onClick={() => setIsMobileOpen(false)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5 rounded-DEFAULT border-l-4 transition-all group',
                  isActive
                    ? 'bg-primary text-on-primary border-secondary shadow-xs font-bold'
                    : 'text-on-surface-variant border-transparent hover:bg-surface-container-high hover:text-primary'
                )}
              >
                <span className={cn('material-symbols-outlined text-[20px]', isActive && 'filled')}>
                  {item.icon}
                </span>
                <span className="text-sm font-semibold">{item.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>

      {/* User Info & Logout */}
      <div className="px-4 pt-4 border-t border-outline-variant/60 mt-auto space-y-3">
        <div className="flex items-center gap-3 px-2">
          <Avatar size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-primary truncate">{responderUser?.name || 'Responder Admin'}</p>
            <p className="text-[10px] text-on-surface-variant truncate">{responderUser?.email}</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full text-xs font-bold text-error bg-error/10 hover:bg-error hover:text-white py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer border border-error/20"
        >
          <span className="material-symbols-outlined text-base">logout</span>
          Sign Out of Command Center
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex h-screen sticky top-0 left-0 z-40 shrink-0 w-64">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-primary/40 backdrop-blur-xs" onClick={() => setIsMobileOpen(false)} />
          <aside className="relative z-10 h-full w-64 shadow-2xl animate-slide-in-right">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 w-full bg-surface/95 backdrop-blur-md border-b border-outline-variant/60 z-30 px-4 sm:px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="md:hidden p-2 text-on-surface-variant hover:text-primary rounded-lg cursor-pointer"
            >
              <span className="material-symbols-outlined text-2xl">menu</span>
            </button>

            <div>
              <span className="text-xs font-bold text-secondary uppercase tracking-wider block">Protected Portal</span>
              <h1 className="text-body-lg font-extrabold text-primary">Responder Command Center</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(ROUTES.LANDING)}
              className="text-xs font-bold text-on-surface-variant hover:text-primary bg-surface-container px-3 py-1.5 rounded-lg border border-outline-variant/60 cursor-pointer hidden sm:flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">home</span>
              Entry Portal
            </button>
            <Avatar size="md" />
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-[1280px] mx-auto animate-fade-in">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
