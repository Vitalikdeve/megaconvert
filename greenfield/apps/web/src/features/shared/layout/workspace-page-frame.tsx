import { StatusBadge } from '@megaconvert/design-system';

import type { PropsWithChildren, ReactNode } from 'react';

export interface WorkspacePageFrameProps extends PropsWithChildren {
  actions?: ReactNode;
  description: string;
  eyebrow: string;
  metadata?: ReactNode;
  title: string;
}

export function WorkspacePageFrame({
  actions,
  children,
  description,
  eyebrow,
  metadata,
  title,
}: WorkspacePageFrameProps) {
  return (
    <div className="grid gap-4">
      <section className="rounded-[2rem] border border-outline-soft bg-surface/70 p-5 shadow-soft backdrop-blur-2xl sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label={eyebrow} tone="accent" />
              {metadata}
            </div>
            <h2 className="mt-4 font-[family-name:var(--font-display)] text-[1.7rem] font-semibold tracking-[-0.05em] text-ink sm:text-[2rem]">
              {title}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-ink-muted sm:text-[0.98rem]">
              {description}
            </p>
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      </section>
      {children}
    </div>
  );
}
