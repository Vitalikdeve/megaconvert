import { clsx } from 'clsx';

import type { PropsWithChildren } from 'react';

export interface AppFrameProps extends PropsWithChildren {
  className?: string;
}

export function AppFrame({ children, className }: AppFrameProps) {
  return <div className={clsx('mc-app-frame', className)}>{children}</div>;
}
