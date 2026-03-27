'use client';

import { Button, ErrorState, Surface } from '@megaconvert/design-system';

export interface AuthRequiredStateProps {
  actionLabel?: string;
  description: string;
  onRetry?: () => void;
  title: string;
}

export function AuthRequiredState({
  actionLabel = 'Retry',
  description,
  onRetry,
  title,
}: AuthRequiredStateProps) {
  return (
    <Surface className="p-4 sm:p-5" tone="elevated">
      <ErrorState
        action={
          onRetry ? (
            <Button
              onClick={() => {
                onRetry();
              }}
              tone="secondary"
            >
              {actionLabel}
            </Button>
          ) : null
        }
        title={title}
      >
        <p>{description}</p>
      </ErrorState>
    </Surface>
  );
}
