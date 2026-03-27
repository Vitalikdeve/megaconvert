import { WorkspaceShell } from '@/features/shared/layout/workspace-shell';

import type { PropsWithChildren } from 'react';


export default function WorkspaceLayout({ children }: PropsWithChildren) {
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
