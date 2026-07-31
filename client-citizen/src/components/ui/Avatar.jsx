import { cn } from '../../utils/helpers';

export default function Avatar({ src, alt, size = 'md', className }) {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  return (
    <div
      className={cn(
        'rounded-full bg-surface-variant border border-outline-variant overflow-hidden flex items-center justify-center shrink-0',
        sizes[size],
        className
      )}
    >
      {src ? (
        <img className="w-full h-full object-cover" src={src} alt={alt || 'User avatar'} />
      ) : (
        <span className="material-symbols-outlined text-on-surface-variant">person</span>
      )}
    </div>
  );
}
