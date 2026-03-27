import { clsx } from 'clsx';

import type { PropsWithChildren } from 'react';

export interface KbdProps extends PropsWithChildren {
  className?: string;
}

export function Kbd({ children, className }: KbdProps) {
  return <kbd className={clsx('mc-kbd', className)}>{children}</kbd>;
}
