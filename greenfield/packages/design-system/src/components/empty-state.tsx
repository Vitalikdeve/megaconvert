import { clsx } from 'clsx';

import type { PropsWithChildren, ReactNode } from 'react';

export interface EmptyStateProps extends PropsWithChildren {
  action?: ReactNode;
  className?: string;
  eyebrow?: string;
  icon?: ReactNode;
  title: string;
}

export function EmptyState({
  action,
  children,
  className,
  eyebrow,
  icon,
  title,
}: EmptyStateProps) {
  return (
    <section className={clsx('mc-empty-state', className)}>
      {icon ? <div className="mc-empty-state__icon">{icon}</div> : null}
      {eyebrow ? <p className="mc-empty-state__eyebrow">{eyebrow}</p> : null}
      <h2 className="mc-empty-state__title">{title}</h2>
      {children ? <div className="mc-empty-state__body">{children}</div> : null}
      {action ? <div className="mc-empty-state__action">{action}</div> : null}
    </section>
  );
}
