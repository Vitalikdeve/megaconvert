'use client';

import { Button, ErrorState, Surface } from '@megaconvert/design-system';

export interface RouteErrorStateProps {
  description: string;
  onRetry?: () => void;
  title: string;
}

export function RouteErrorState({ description, onRetry, title }: RouteErrorStateProps) {
  return (
    <Surface className="p-4 sm:p-5" tone="elevated">
      <ErrorState
        action={
          onRetry ? (
            <Button
              onClick={() => {
                onRetry();
              }}
              tone="primary"
            >
              Retry view
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
