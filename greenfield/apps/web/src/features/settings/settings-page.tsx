'use client';

import { StatusBadge } from '@megaconvert/design-system';

import { WorkspacePageFrame } from '@/features/shared/layout/workspace-page-frame';

import { AccountPreferencesCard } from './components/account-preferences-card';
import { BlockedUsersCard } from './components/blocked-users-card';
import { PrivacySettingsCard } from './components/privacy-settings-card';

export function SettingsPage() {
  return (
    <WorkspacePageFrame
      description="Settings is now backed by real account preference, privacy, and safety APIs. These controls persist at the user level so future inbox, chat, and meetings surfaces can inherit them consistently."
      eyebrow="Settings"
      metadata={<StatusBadge label="Persisted account settings" tone="success" />}
      title="Preferences, privacy, and safety"
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <AccountPreferencesCard />
        <PrivacySettingsCard />
      </div>
      <BlockedUsersCard />
    </WorkspacePageFrame>
  );
}
