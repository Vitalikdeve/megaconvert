'use client';

import { SectionCard, StatusBadge } from '@megaconvert/design-system';

import { WorkspacePageFrame } from '@/features/shared/layout/workspace-page-frame';

import { ProfileEditorCard } from './components/profile-editor-card';

export function ProfilePage() {
  return (
    <WorkspacePageFrame
      description="Profile is the durable identity surface shared across inbox, chats, meetings, and search. The data on this page is backed by live current-user APIs and saved through optimistic mutations."
      eyebrow="Profile"
      metadata={<StatusBadge label="Current-user domain" tone="accent" />}
      title="Identity, read model, and discovery surface"
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
        <ProfileEditorCard />

        <SectionCard
          description="The same profile card contract is designed to feed chat and meeting participant surfaces."
          eyebrow="Read model"
          title="Context projection"
        >
          <p className="text-sm leading-7 text-ink-muted">
            Username, display name, avatar URL, and status text now share one contract across the
            API and web client. That keeps chat and meeting identity rendering consistent as those
            domains come online.
          </p>
        </SectionCard>
      </div>
    </WorkspacePageFrame>
  );
}
