import { cn } from '../../utils/helpers';

export default function Skeleton({ width, height, rounded = 'md', className }) {
  return (
    <div
      className={cn(
        'animate-skeleton',
        rounded === 'sm' && 'rounded-sm',
        rounded === 'md' && 'rounded-DEFAULT',
        rounded === 'lg' && 'rounded-lg',
        rounded === 'full' && 'rounded-full',
        className
      )}
      style={{ width, height }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 space-y-4">
      <Skeleton width="60%" height="24px" />
      <Skeleton width="100%" height="16px" />
      <Skeleton width="80%" height="16px" />
      <div className="flex gap-4 pt-4 border-t border-outline-variant">
        <Skeleton width="33%" height="40px" />
        <Skeleton width="33%" height="40px" />
        <Skeleton width="33%" height="40px" />
      </div>
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 py-3">
      <Skeleton width="40px" height="40px" rounded="full" />
      <div className="flex-1 space-y-2">
        <Skeleton width="40%" height="14px" />
        <Skeleton width="60%" height="12px" />
      </div>
      <Skeleton width="60px" height="24px" rounded="sm" />
    </div>
  );
}

export function SkeletonTable({ rows = 4 }) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-4 space-y-3">
      <div className="flex justify-between pb-3 border-b border-outline-variant/60">
        <Skeleton width="20%" height="18px" />
        <Skeleton width="15%" height="18px" />
        <Skeleton width="15%" height="18px" />
        <Skeleton width="10%" height="18px" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}
