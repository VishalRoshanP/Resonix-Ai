import { useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../../utils/helpers';
import { SIDEBAR_NAV_ITEMS, SECONDARY_NAV_ITEMS } from '../../constants/navItems';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export default function Sidebar({ isMobileOpen = false, onCloseMobile }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();

  // Close drawer on Esc key and lock body scroll when open on mobile
  useEffect(() => {
    if (!isMobileOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCloseMobile?.();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileOpen, onCloseMobile]);

  // Combine all items to determine strictly ONE active item
  const allNavItems = [...SIDEBAR_NAV_ITEMS, ...SECONDARY_NAV_ITEMS];

  // Find exact match or longest prefix match
  const activePath = (() => {
    const exact = allNavItems.find((item) => item.path === location.pathname);
    if (exact) return exact.path;

    // Find longest matching prefix
    const prefixMatches = allNavItems
      .filter((item) => item.path !== '/' && location.pathname.startsWith(item.path + '/'))
      .sort((a, b) => b.path.length - a.path.length);

    return prefixMatches[0]?.path || null;
  })();

  const content = (
    <div className="flex flex-col h-full py-6 bg-surface-container-low border-r border-outline-variant w-64 shrink-0">
      {/* Header */}
      <div className="px-6 mb-6 flex justify-between items-start">
        <div>
          <h2 className="text-headline-md font-bold text-primary tracking-tight">RESONIX AI</h2>
          <p className="text-xs font-semibold text-secondary flex items-center gap-1.5 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
            Disaster Intelligence Core
          </p>
          <div className="mt-2 text-label-sm uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
            <span className={cn(
              'w-2 h-2 rounded-full',
              isOnline ? 'bg-success animate-pulse' : 'bg-secondary'
            )} />
            {isOnline ? 'Command Center (Online)' : 'Command Center (Offline)'}
          </div>
        </div>

        {/* Mobile Close Button */}
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1.5 text-on-surface-variant hover:text-primary rounded-lg hover:bg-surface-container cursor-pointer"
            title="Close navigation"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        )}
      </div>

      {/* Main Navigation */}
      <ul className="flex-1 px-4 space-y-1 overflow-y-auto">
        {SIDEBAR_NAV_ITEMS.map((item) => {
          const isActive = activePath === item.path;

          return (
            <li key={item.path}>
              <NavLink
                to={item.path}
                onClick={onCloseMobile}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-DEFAULT border-l-4 transition-all group',
                  isActive
                    ? 'bg-secondary text-white border-primary shadow-sm'
                    : 'text-on-surface-variant border-transparent hover:bg-surface-container-high hover:text-primary hover:border-outline-variant'
                )}
              >
                <span
                  className={cn(
                    'material-symbols-outlined transition-colors text-[22px]',
                    isActive && 'filled'
                  )}
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {item.icon}
                </span>
                <span className="font-semibold text-sm">{item.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>

      {/* Bottom Section */}
      <div className="px-4 mt-auto space-y-4 pt-4 border-t border-outline-variant/60">
        {/* Voice Relay Button */}
        <button
          onClick={() => {
            if (onCloseMobile) onCloseMobile();
            navigate('/voice-relay');
          }}
          className="w-full bg-primary text-white font-bold py-2.5 px-3 rounded-DEFAULT border-b-[2px] border-tertiary flex items-center justify-center gap-2 hover:bg-tertiary active:translate-y-[1px] active:border-b-0 transition-all uppercase tracking-widest text-xs cursor-pointer"
        >
          <span className="material-symbols-outlined text-lg">mic</span>
          Voice Relay
        </button>

        {/* Secondary Links */}
        <ul className="space-y-1">
          {SECONDARY_NAV_ITEMS.map((item) => {
            const isActive = activePath === item.path;
            return (
              <li key={item.label}>
                <NavLink
                  to={item.path}
                  onClick={onCloseMobile}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2 rounded-DEFAULT transition-all text-sm font-medium',
                    isActive
                      ? 'bg-surface-container-high text-primary font-bold border-l-2 border-secondary'
                      : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-high'
                  )}
                >
                  <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                  {item.label}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Sticky, w-64) */}
      <aside className="hidden md:flex h-screen sticky top-0 left-0 z-40 shrink-0 w-64">
        {content}
      </aside>

      {/* Mobile Drawer Navigation */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-primary/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />

          {/* Slide-over Content */}
          <aside className="relative z-10 h-full w-64 shadow-2xl animate-slide-in-right">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
