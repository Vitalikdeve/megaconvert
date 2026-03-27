import { clsx } from 'clsx';

export type StatusBadgeTone = 'accent' | 'danger' | 'neutral' | 'success' | 'warning';

export interface StatusBadgeProps {
  className?: string;
  label: string;
  tone?: StatusBadgeTone;
}

export function StatusBadge({ className, label, tone = 'neutral' }: StatusBadgeProps) {
  return (
    <span className={clsx('mc-status-badge', `mc-status-badge--${tone}`, className)}>
      {label}
    </span>
  );
}
