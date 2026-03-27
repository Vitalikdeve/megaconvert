'use client';

import { FoundationStatusPanel } from '../foundation/foundation-status-panel';

import { AppearanceControlsCard } from './appearance-controls-card';

export interface WorkspaceDockProps {
  compact?: boolean;
}

export function WorkspaceDock({ compact = false }: WorkspaceDockProps) {
  return (
    <div className="grid gap-4">
      <FoundationStatusPanel compact={compact} />
      <AppearanceControlsCard compact={compact} />
    </div>
  );
}
