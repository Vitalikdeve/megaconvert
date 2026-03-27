'use client';

import {
  Button,
  ErrorState,
  SectionCard,
  SkeletonBlock,
  StatusBadge,
} from '@megaconvert/design-system';
import { useEffect, useState } from 'react';

import { TextAreaField, TextField } from '@/features/shared/forms/form-controls';

import { useCurrentProfileQuery, useUpdateProfileMutation } from '../data/user-domain-hooks';

import { ProfileCard } from './profile-card';

import type { UserProfile } from '@megaconvert/contracts';

export function ProfileEditorCard() {
  const profileQuery = useCurrentProfileQuery();
  const updateProfileMutation = useUpdateProfileMutation();
  const [draft, setDraft] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (profileQuery.data) {
      setDraft(profileQuery.data);
    }
  }, [profileQuery.data]);

  if (profileQuery.isError) {
    return (
      <SectionCard
        description="This screen needs an authenticated current-user session to load."
        eyebrow="Profile"
        title="Identity surface"
      >
        <ErrorState
          action={
            <Button onClick={() => profileQuery.refetch()} size="sm" tone="secondary">
              Retry
            </Button>
          }
          title="Profile data is unavailable"
        >
          <p className="text-sm leading-6 text-ink-muted">
            The profile endpoint could not be reached or the current session is unavailable.
          </p>
        </ErrorState>
      </SectionCard>
    );
  }

  if (profileQuery.isLoading || !draft) {
    return (
      <SectionCard
        description="This card is backed by the live current-user profile endpoint."
        eyebrow="Profile"
        title="Identity surface"
      >
        <div className="grid gap-4">
          <SkeletonBlock className="h-28 rounded-[1.5rem]" />
          <SkeletonBlock className="h-14 rounded-[1rem]" />
          <SkeletonBlock className="h-14 rounded-[1rem]" />
          <SkeletonBlock className="h-32 rounded-[1rem]" />
        </div>
      </SectionCard>
    );
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(profileQuery.data);

  return (
    <SectionCard
      description="Identity data is separated from auth provider linkage and stays editable here."
      eyebrow="Profile"
      title="Current user identity"
    >
      <div className="grid gap-4">
        <ProfileCard
          accentLabel="Current user"
          profile={draft}
          subtitle={draft.bio ?? 'Add a short bio so colleagues can identify context quickly.'}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            description="Visible across chat and meeting surfaces."
            label="Display name"
            onChange={(event) => {
              setDraft((currentDraft) =>
                currentDraft
                  ? {
                      ...currentDraft,
                      displayName: event.target.value,
                    }
                  : currentDraft,
              );
            }}
            value={draft.displayName}
          />
          <TextField
            description="Used for mentions, links, and user discovery."
            label="Username"
            onChange={(event) => {
              setDraft((currentDraft) =>
                currentDraft
                  ? {
                      ...currentDraft,
                      username: event.target.value.toLowerCase(),
                    }
                  : currentDraft,
              );
            }}
            value={draft.username}
          />
          <TextField
            description="External avatar URLs are supported now and can later map to the media domain."
            label="Avatar URL"
            onChange={(event) => {
              setDraft((currentDraft) =>
                currentDraft
                  ? {
                      ...currentDraft,
                      avatarUrl: event.target.value,
                    }
                  : currentDraft,
              );
            }}
            placeholder="https://..."
            value={draft.avatarUrl ?? ''}
          />
          <TextField
            description="Stored as the profile locale and used as the default language hint."
            label="Locale"
            onChange={(event) => {
              setDraft((currentDraft) =>
                currentDraft
                  ? {
                      ...currentDraft,
                      locale: event.target.value,
                    }
                  : currentDraft,
              );
            }}
            placeholder="en"
            value={draft.locale ?? ''}
          />
          <TextField
            description="Short status text appears in compact profile cards."
            label="Status"
            onChange={(event) => {
              setDraft((currentDraft) =>
                currentDraft
                  ? {
                      ...currentDraft,
                      statusText: event.target.value,
                    }
                  : currentDraft,
              );
            }}
            value={draft.statusText ?? ''}
          />
          <div className="rounded-[1.15rem] border border-outline-soft bg-panel/55 p-4">
            <p className="text-sm font-semibold tracking-[-0.02em] text-ink">Primary email</p>
            <p className="mt-2 text-sm leading-7 text-ink-muted">{draft.email}</p>
            <div className="mt-3">
              <StatusBadge label="Auth-linked" tone="success" />
            </div>
          </div>
        </div>

        <TextAreaField
          description="This bio becomes the long-form identity summary in profile and directory surfaces."
          label="Bio"
          maxLength={240}
          onChange={(event) => {
            setDraft((currentDraft) =>
              currentDraft
                ? {
                    ...currentDraft,
                    bio: event.target.value,
                  }
                : currentDraft,
            );
          }}
          value={draft.bio ?? ''}
        />

        {updateProfileMutation.isError ? (
          <div className="rounded-[1.15rem] border border-danger/20 bg-danger/6 px-4 py-3 text-sm leading-6 text-danger">
            {(updateProfileMutation.error as Error).message}
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            onClick={() => {
              setDraft(profileQuery.data ?? null);
            }}
            size="sm"
            tone="secondary"
          >
            Reset
          </Button>
          <Button
            disabled={!dirty || updateProfileMutation.isPending}
            onClick={() => {
              void updateProfileMutation.mutateAsync({
                avatarUrl: draft.avatarUrl && draft.avatarUrl.length > 0 ? draft.avatarUrl : null,
                bio: draft.bio && draft.bio.length > 0 ? draft.bio : null,
                displayName: draft.displayName,
                locale: draft.locale && draft.locale.length > 0 ? draft.locale : null,
                statusText:
                  draft.statusText && draft.statusText.length > 0 ? draft.statusText : null,
                username: draft.username,
              });
            }}
            size="sm"
          >
            {updateProfileMutation.isPending ? 'Saving profile...' : 'Save profile'}
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}
