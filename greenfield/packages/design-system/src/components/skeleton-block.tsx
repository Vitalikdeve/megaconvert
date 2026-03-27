import { clsx } from 'clsx';

export interface SkeletonBlockProps {
  className?: string;
}

export function SkeletonBlock({ className }: SkeletonBlockProps) {
  return <div aria-hidden="true" className={clsx('mc-skeleton-block', className)} />;
}
