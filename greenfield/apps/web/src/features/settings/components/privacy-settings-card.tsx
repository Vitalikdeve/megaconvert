'use client';

import { Button, ErrorState, SectionCard, SkeletonBlock } from '@megaconvert/design-system';
import { useEffect, useState } from 'react';

import { usePrivacySettingsQuery, useUpdatePrivacySettingsMutation } from '@/features/profile/data/user-domain-hooks';
import { SelectField, ToggleField } from '@/features/shared/forms/form-controls';

import type { UserPrivacySettings, VisibilityScope } from '@megaconvert/contracts';

const visibilityOptions: Array<{ label: string; value: VisibilityScope }> = [
  { label: 'Everyone', value: 'everyone' },
  { label: 'Contacts only', value: 'contacts_only' },
  { label: 'Nobody', value: 'nobody' },
];

export function PrivacySettingsCard() {
  const privacyQuery = usePrivacySettingsQuery();
  const updatePrivacyMutation = useUpdatePrivacySettingsMutation();
  const [draft, setDraft] = useState<UserPrivacySettings | null>(null);

  useEffect(() => {
    if (privacyQuery.data) {
      setDraft(privacyQuery.data);
    }
  }, [privacyQuery.data]);

  if (privacyQuery.isError) {
    return (
      <SectionCard eyebrow="Privacy" title="Privacy controls">
        <ErrorState
          action={
            <Button onClick={() => privacyQuery.refetch()} size="sm" tone="secondary">
              Retry
            </Button>
          }
          title="Privacy settings are unavailable"
        >
          <p className="text-sm leading-6 text-ink-muted">
            The privacy settings endpoint could not be loaded for this session.
          </p>
        </ErrorState>
      </SectionCard>
    );
  }

  if (privacyQuery.isLoading || !draft) {
    return (
      <SectionCard eyebrow="Privacy" title="Privacy controls">
        <div className="grid gap-4">
          <SkeletonBlock className="h-16 rounded-[1rem]" />
          <SkeletonBlock className="h-16 rounded-[1rem]" />
          <SkeletonBlock className="h-16 rounded-[1rem]" />
        </div>
      </SectionCard>
    );
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(privacyQuery.data);

  return (
    <SectionCard
      description="The privacy model is explicit and future-proofed for more granular discovery and presence policy later."
      eyebrow="Privacy"
      title="Privacy controls"
    >
      <div className="grid gap-4">
        <SelectField
          label="Profile visibility"
          onChange={(event) => {
            setDraft((currentDraft) =>
              currentDraft
                ? {
                    ...currentDraft,
                    profileScope: event.target.value as VisibilityScope,
                  }
                : currentDraft,
            );
          }}
          value={draft.profileScope}
        >
          {visibilityOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>

        <div className="grid gap-4 md:grid-cols-2">
          <SelectField
            label="Presence visibility"
            onChange={(event) => {
              setDraft((currentDraft) =>
                currentDraft
                  ? {
                      ...currentDraft,
                      presenceScope: event.target.value as VisibilityScope,
                    }
                  : currentDraft,
              );
            }}
            value={draft.presenceScope}
          >
            {visibilityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Meeting presence visibility"
            onChange={(event) => {
              setDraft((currentDraft) =>
                currentDraft
                  ? {
                      ...currentDraft,
                      meetingPresenceScope: event.target.value as VisibilityScope,
                    }
                  : currentDraft,
              );
            }}
            value={draft.meetingPresenceScope}
          >
            {visibilityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Direct message policy"
            onChange={(event) => {
              setDraft((currentDraft) =>
                currentDraft
                  ? {
                      ...currentDraft,
                      directMessageScope: event.target.value as VisibilityScope,
                    }
                  : currentDraft,
              );
            }}
            value={draft.directMessageScope}
          >
            {visibilityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
        </div>

        <ToggleField
          checked={draft.discoverableByEmail}
          description="Allows people who already know your email address to discover your profile."
          label="Discoverable by email"
          onChange={(discoverableByEmail) => {
            setDraft((currentDraft) =>
              currentDraft
                ? {
                    ...currentDraft,
                    discoverableByEmail,
                  }
                : currentDraft,
            );
          }}
        />
        <ToggleField
          checked={draft.discoverableByUsername}
          description="Controls whether profile discovery is permitted through your username."
          label="Discoverable by username"
          onChange={(discoverableByUsername) => {
            setDraft((currentDraft) =>
              currentDraft
                ? {
                    ...currentDraft,
                    discoverableByUsername,
                  }
                : currentDraft,
            );
          }}
        />
        <ToggleField
          checked={draft.readReceiptsEnabled}
          description="Read receipt publication is wired as an explicit privacy policy, not a chat-only toggle."
          label="Read receipts"
          onChange={(readReceiptsEnabled) => {
            setDraft((currentDraft) =>
              currentDraft
                ? {
                    ...currentDraft,
                    readReceiptsEnabled,
                  }
                : currentDraft,
            );
          }}
        />

        <div className="flex justify-end">
          <Button
            disabled={!dirty || updatePrivacyMutation.isPending}
            onClick={() => {
              void updatePrivacyMutation.mutateAsync(draft);
            }}
            size="sm"
          >
            {updatePrivacyMutation.isPending ? 'Saving privacy...' : 'Save privacy'}
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}
