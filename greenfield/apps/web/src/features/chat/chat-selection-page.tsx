import { Button, EmptyState, Surface } from '@megaconvert/design-system';
import Link from 'next/link';

export function ChatSelectionPage() {
  return (
    <Surface className="p-5 sm:p-6" tone="elevated">
      <EmptyState
        action={
          <Link href="/inbox">
            <Button>Open inbox</Button>
          </Link>
        }
        title="Choose a conversation"
      >
        <p>Select a direct or group chat from the inbox to open the live conversation canvas.</p>
      </EmptyState>
    </Surface>
  );
}
