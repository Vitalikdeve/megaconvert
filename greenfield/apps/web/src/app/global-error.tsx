'use client';

import '@megaconvert/design-system/styles.css';

import { Button, ErrorState, Surface } from '@megaconvert/design-system';

import './globals.css';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-10">
          <Surface className="w-full p-5 sm:p-6" tone="elevated">
            <ErrorState
              action={
                <Button
                  onClick={() => {
                    reset();
                  }}
                >
                  Reload shell
                </Button>
              }
              title="The interface hit an unrecoverable rendering error."
            >
              <p>{error.message}</p>
            </ErrorState>
          </Surface>
        </main>
      </body>
    </html>
  );
}
