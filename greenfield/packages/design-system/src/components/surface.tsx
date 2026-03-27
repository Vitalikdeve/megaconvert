import { clsx } from 'clsx';

import type { HTMLAttributes, PropsWithChildren } from 'react';

export interface SurfaceProps
  extends PropsWithChildren,
    Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  className?: string;
  tone?: 'contrast' | 'default' | 'elevated' | 'subtle';
}

export function Surface({
  children,
  className,
  tone = 'default',
  ...props
}: SurfaceProps) {
  return (
    <div className={clsx('mc-surface', `mc-surface--${tone}`, className)} {...props}>
      {children}
    </div>
  );
}
