import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../../utils/helpers';
import { MOBILE_NAV_ITEMS } from '../../constants/navItems';

export default function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  // Split items: first 2 go left, last 2 go right, center = Voice FAB
  const leftItems = MOBILE_NAV_ITEMS.slice(0, 2);
  const rightItems = MOBILE_NAV_ITEMS.slice(2);

  // Determine strictly ONE active path
  const activePath = (() => {
    const exact = MOBILE_NAV_ITEMS.find((item) => item.path === location.pathname);
    if (exact) return exact.path;

    const prefixMatches = MOBILE_NAV_ITEMS
      .filter((item) => item.path !== '/' && location.pathname.startsWith(item.path + '/'))
      .sort((a, b) => b.path.length - a.path.length);

    return prefixMatches[0]?.path || null;
  })();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-md border-t border-outline-variant flex justify-around items-center px-3 py-2 z-50 shadow-nav">
      {/* Left Items */}
      {leftItems.map((item) => {
        const isActive = activePath === item.path;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 min-w-[56px] py-1 px-2 rounded-lg transition-colors',
              isActive ? 'text-secondary font-bold bg-secondary/10' : 'text-on-surface-variant hover:text-primary'
            )}
          >
            <span
              className="material-symbols-outlined text-[22px]"
              style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {item.icon}
            </span>
            <span className={cn('text-[10px] tracking-tight', isActive ? 'font-bold' : 'font-medium')}>
              {item.label}
            </span>
          </NavLink>
        );
      })}

      {/* Center Floating Voice Relay Button */}
      <div className="relative -top-5 shrink-0">
        <button
          onClick={() => navigate('/voice-relay')}
          title="Voice Relay"
          className="w-13 h-13 rounded-full bg-primary text-white flex items-center justify-center shadow-lg border-4 border-surface cursor-pointer hover:bg-tertiary active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-2xl">mic</span>
        </button>
      </div>

      {/* Right Items */}
      {rightItems.map((item) => {
        const isActive = activePath === item.path;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 min-w-[56px] py-1 px-2 rounded-lg transition-colors',
              isActive ? 'text-secondary font-bold bg-secondary/10' : 'text-on-surface-variant hover:text-primary'
            )}
          >
            <span
              className="material-symbols-outlined text-[22px]"
              style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {item.icon}
            </span>
            <span className={cn('text-[10px] tracking-tight', isActive ? 'font-bold' : 'font-medium')}>
              {item.label}
            </span>
          </NavLink>
        );
      })}
    </nav>
  );
}
