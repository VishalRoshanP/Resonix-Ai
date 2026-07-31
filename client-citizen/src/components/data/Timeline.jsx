import { useState } from 'react';
import { cn } from '../../utils/helpers';

const nodeIcons = {
  check: { icon: 'check', bg: 'bg-primary', text: 'text-white' },
  sync: { icon: 'sync_alt', bg: 'bg-secondary', text: 'text-white' },
  mic: { icon: 'mic', bg: 'bg-surface-container border-2 border-outline-variant', text: 'text-on-surface-variant' },
  warning: { icon: 'warning', bg: 'bg-error', text: 'text-white' },
  success: { icon: 'check_circle', bg: 'bg-success', text: 'text-white' },
};

export default function Timeline({ items = [], title = 'Network Activity', showFilter = true }) {
  const [activeFilter, setActiveFilter] = useState('all');

  const filteredItems = items.filter((item) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'voice') return item.type === 'mic';
    if (activeFilter === 'alerts') return item.type === 'warning';
    if (activeFilter === 'system') return item.type === 'check' || item.type === 'sync' || item.type === 'success';
    return true;
  });

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-body-lg font-bold text-primary">{title}</h3>
        {showFilter && (
          <div className="flex gap-1 bg-surface-container-low p-1 rounded-lg border border-outline-variant/40">
            {['all', 'system', 'voice', 'alerts'].map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={cn(
                  'px-2 py-0.5 text-[10px] font-bold uppercase rounded transition-all cursor-pointer',
                  activeFilter === f
                    ? 'bg-surface-container-lowest text-primary shadow-xs font-bold'
                    : 'text-on-surface-variant hover:text-primary'
                )}
              >
                {f}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative flex-1">
        {/* Vertical Line */}
        <div className="absolute left-[11px] top-2 bottom-2 w-[2px] bg-outline-variant" />

        <ul className="space-y-5 relative z-10">
          {filteredItems.map((item, index) => {
            const nodeStyle = nodeIcons[item.type] || nodeIcons.check;

            return (
              <li key={index} className="flex gap-4 animate-slide-up" style={{ animationDelay: `${index * 80}ms` }}>
                <div
                  className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                    nodeStyle.bg,
                    !nodeStyle.bg.includes('border') && 'border-2 border-surface-container-lowest'
                  )}
                >
                  <span className={cn('material-symbols-outlined text-[12px]', nodeStyle.text)}>
                    {nodeStyle.icon}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5 gap-2">
                    <p className="font-bold text-sm text-primary truncate">{item.title}</p>
                    <span className="text-xs text-mono-data text-on-surface-variant shrink-0">{item.time}</span>
                  </div>
                  <p className="text-xs text-on-surface-variant leading-normal">{item.description}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
