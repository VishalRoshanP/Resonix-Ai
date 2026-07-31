import { cn } from '../../utils/helpers';

export default function Card({ children, className, ...props }) {
  return (
    <div
      className={cn('bg-surface-container-lowest border border-outline-variant/80 rounded-2xl shadow-xs p-5 transition-all', className)}
      {...props}
    >
      {children}
    </div>
  );
}
