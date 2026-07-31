import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../../utils/helpers';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';

// Map route path to human-readable breadcrumb segments
const ROUTE_BREADCRUMBS = {
  '/dashboard': ['Dashboard'],
  '/dashboard/refined': ['Dashboard', 'Refined Telemetry'],
  '/dashboard/predictive': ['Dashboard', 'Predictive Forecast'],
  '/map': ['Map', 'Disaster Intelligence'],
  '/map/signals': ['Map', 'Signal Strength'],
  '/intelligence': ['Intelligence', 'Executive Briefing'],
  '/intelligence/map': ['Intelligence', 'Geospatial Map'],
  '/intelligence/personnel': ['Intelligence', 'Personnel Data'],
  '/incident': ['Active Incidents'],
  '/personnel': ['Personnel', 'Overview'],
  '/personnel/data': ['Personnel', 'Biometric Pulses'],
  '/personnel/drilldown': ['Personnel', 'Member Detail'],
  '/logistics': ['Logistics', 'Overview'],
  '/logistics/alerts': ['Logistics', 'Alert Pulses'],
  '/logistics/geo': ['Logistics', 'Geospatial Routes'],
  '/logistics/deployment': ['Logistics', 'Unit Deployments'],
  '/logistics/predictive': ['Logistics', 'Predictive Models'],
  '/analytics': ['Analytics'],
  '/diagnostics': ['System Health'],
  '/crisis-log': ['Incident Timeline'],
  '/crisis-log/predictive': ['Incident Timeline', 'Predictive Insights'],
  '/settings': ['Settings'],
  '/emergency-guide': ['Documentation'],
  '/voice-relay': ['Voice Relay'],
  '/voice-emergency': ['Voice Emergency'],
  '/sos': ['Emergency SOS'],
  '/citizen': ['Citizen Portal'],
};

export default function TopBar({ onToggleMobileSidebar }) {
  const navigate = useNavigate();
  const location = useLocation();

  const breadcrumbSegments = ROUTE_BREADCRUMBS[location.pathname] || ['RESONIX AI'];

  return (
    <header className="sticky top-0 w-full bg-surface/95 backdrop-blur-sm border-b border-outline-variant z-30">
      <div className="max-w-[1280px] mx-auto flex justify-between items-center w-full px-4 sm:px-6 lg:px-8 py-3.5">
        {/* Left Section: Mobile Drawer Toggle & Breadcrumbs */}
        <div className="flex items-center gap-3">
          {/* Mobile Hamburger Button */}
          {onToggleMobileSidebar && (
            <button
              onClick={onToggleMobileSidebar}
              className="md:hidden p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-lg transition-colors cursor-pointer"
              title="Open Navigation"
            >
              <span className="material-symbols-outlined text-2xl">menu</span>
            </button>
          )}

          {/* Title & Breadcrumbs */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-headline-md font-bold text-primary tracking-tight">RESONIX AI</span>

              {/* Breadcrumb Trail */}
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-on-surface-variant">
                <span className="text-outline-variant">/</span>
                {breadcrumbSegments.map((segment, index) => (
                  <span key={segment} className="flex items-center gap-1.5">
                    {index > 0 && <span className="text-outline-variant">/</span>}
                    <span className={cn(
                      index === breadcrumbSegments.length - 1
                        ? 'font-bold text-primary bg-surface-container px-2 py-0.5 rounded border border-outline-variant/60'
                        : 'font-medium'
                    )}>
                      {segment}
                    </span>
                  </span>
                ))}
              </div>
            </div>

            {/* Mobile Sub-breadcrumb */}
            <span className="sm:hidden text-[10px] font-semibold text-secondary flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
              {breadcrumbSegments[breadcrumbSegments.length - 1]}
            </span>

            {/* Desktop Powered Subtitle */}
            <span className="hidden md:flex text-xs font-semibold text-secondary items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
              Powered by Gemma 4
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Emergency Signal Button (Desktop) */}
          <Button
            variant="urgent"
            size="md"
            icon="emergency"
            className="hidden md:flex"
            onClick={() => navigate('/voice-emergency')}
          >
            Emergency Signal
          </Button>

          {/* Mobile Emergency Signal Icon Button */}
          <button
            onClick={() => navigate('/voice-emergency')}
            title="Emergency Signal"
            className="md:hidden p-2 rounded-full bg-secondary/10 border border-secondary/30 text-secondary hover:bg-secondary hover:text-white transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">emergency</span>
          </button>

          {/* Icon Buttons */}
          <div className="flex items-center gap-1 sm:gap-2 text-on-surface-variant">
            <button
              onClick={() => navigate('/settings')}
              title="Settings"
              className="p-2 rounded-full hover:bg-surface-container-low transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">settings</span>
            </button>
            <button
              title="Notifications"
              className="p-2 rounded-full hover:bg-surface-container-low transition-colors relative cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-secondary rounded-full ring-2 ring-surface" />
            </button>
          </div>

          {/* User Avatar */}
          <Avatar size="md" />
        </div>
      </div>
    </header>
  );
}
