import { clsx } from 'clsx';

import type { PropsWithChildren, ReactNode } from 'react';

export interface SectionCardProps extends PropsWithChildren {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  className?: string;
}

export function SectionCard({
  children,
  className,
  description,
  eyebrow,
  title,
}: SectionCardProps) {
  return (
    <section className={clsx('mc-section-card mc-surface mc-surface--elevated', className)}>
      <header className="mc-section-card__header">
        {eyebrow ? <p className="mc-section-card__eyebrow">{eyebrow}</p> : null}
        <h2 className="mc-section-card__title">{title}</h2>
        {description ? <div className="mc-section-card__description">{description}</div> : null}
      </header>
      <div className="mc-section-card__content">{children}</div>
    </section>
  );
}
