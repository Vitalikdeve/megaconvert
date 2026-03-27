'use client';

import { RouteErrorState } from '@/features/shared/states/route-error-state';

export default function WorkspaceErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorState
      description={error.message}
      onRetry={reset}
      title="This workspace view failed to render."
    />
  );
}
