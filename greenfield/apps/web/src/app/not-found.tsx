import { Button, ErrorState, Surface } from '@megaconvert/design-system';
import Link from 'next/link';


export default function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-10">
      <Surface className="w-full p-5 sm:p-6" tone="elevated">
        <ErrorState
          action={
            <Link href="/">
              <Button>Return to overview</Button>
            </Link>
          }
          title="That workspace route does not exist."
        >
          <p>The shell is ready for the supported foundation routes, but this address is outside them.</p>
        </ErrorState>
      </Surface>
    </main>
  );
}
