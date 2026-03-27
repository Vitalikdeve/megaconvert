import { EmptyState, Surface } from '@megaconvert/design-system';

import type { ReactNode } from 'react';

export interface FoundationStageCardProps {
  action?: ReactNode;
  description: ReactNode;
  eyebrow: string;
  icon?: ReactNode;
  title: string;
}

export function FoundationStageCard({
  action,
  description,
  eyebrow,
  icon,
  title,
}: FoundationStageCardProps) {
  return (
    <Surface className="p-4 sm:p-5" tone="elevated">
      <EmptyState action={action} eyebrow={eyebrow} icon={icon} title={title}>
        <div>{description}</div>
      </EmptyState>
    </Surface>
  );
}
