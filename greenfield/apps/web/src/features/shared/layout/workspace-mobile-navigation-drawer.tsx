'use client';

import { m } from 'motion/react';

import { WorkspaceNavigation } from './workspace-navigation';

export interface WorkspaceMobileNavigationDrawerProps {
  onNavigate(): void;
  onRequestClose(): void;
  open: boolean;
}

export function WorkspaceMobileNavigationDrawer({
  onNavigate,
  onRequestClose,
  open,
}: WorkspaceMobileNavigationDrawerProps) {
  return (
    <m.div
      animate={{
        opacity: open ? 1 : 0,
        pointerEvents: open ? 'auto' : 'none',
      }}
      className="fixed inset-0 z-30 bg-black/50 p-3 backdrop-blur-sm lg:hidden"
      initial={false}
    >
      <m.div
        animate={{
          opacity: open ? 1 : 0,
          x: open ? 0 : -28,
        }}
        className="h-full max-w-[20rem]"
        initial={false}
      >
        <WorkspaceNavigation onNavigate={onNavigate} />
      </m.div>

      <button
        aria-label="Close navigation"
        className="absolute inset-0 -z-10"
        onClick={onRequestClose}
        type="button"
      />
    </m.div>
  );
}
