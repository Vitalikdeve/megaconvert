import { clsx } from 'clsx';

import type { PropsWithChildren, ReactNode } from 'react';

export interface ErrorStateProps extends PropsWithChildren {
  action?: ReactNode;
  className?: string;
  title: string;
}

export function ErrorState({ action, children, className, title }: ErrorStateProps) {
  return (
    <section className={clsx('mc-error-state', className)}>
      <div className="mc-error-state__signal" aria-hidden="true" />
      <h2 className="mc-error-state__title">{title}</h2>
      {children ? <div className="mc-error-state__body">{children}</div> : null}
      {action ? <div className="mc-error-state__action">{action}</div> : null}
    </section>
  );
}
