'use client';

import { Button, ErrorState, SectionCard, SkeletonBlock } from '@megaconvert/design-system';
import { useEffect, useState } from 'react';

import { usePreferencesQuery, useUpdatePreferencesMutation } from '@/features/profile/data/user-domain-hooks';
import { SelectField, TextField, ToggleField } from '@/features/shared/forms/form-controls';

import type { UserPreferences } from '@megaconvert/contracts';

export function AccountPreferencesCard() {
  const preferencesQuery = usePreferencesQuery();
  const updatePreferencesMutation = useUpdatePreferencesMutation();
  const [draft, setDraft] = useState<UserPreferences | null>(null);

  useEffect(() => {
    if (preferencesQuery.data) {
      setDraft(preferencesQuery.data);
    }
  }, [preferencesQuery.data]);

  if (preferencesQuery.isError) {
    return (
      <SectionCard eyebrow="Preferences" title="Account preferences">
        <ErrorState
          action={
            <Button onClick={() => preferencesQuery.refetch()} size="sm" tone="secondary">
              Retry
            </Button>
          }
          title="Preferences are unavailable"
        >
          <p className="text-sm leading-6 text-ink-muted">
            The current-user preferences endpoint could not be loaded.
          </p>
        </ErrorState>
      </SectionCard>
    );
  }

  if (preferencesQuery.isLoading || !draft) {
    return (
      <SectionCard eyebrow="Preferences" title="Account preferences">
        <div className="grid gap-4">
          <SkeletonBlock className="h-16 rounded-[1rem]" />
          <SkeletonBlock className="h-16 rounded-[1rem]" />
          <SkeletonBlock className="h-16 rounded-[1rem]" />
        </div>
      </SectionCard>
    );
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(preferencesQuery.data);

  return (
    <SectionCard
      description="These settings are stored server-side so account behavior can follow the user across devices."
      eyebrow="Preferences"
      title="Account preferences"
    >
      <div className="grid gap-4">
        <SelectField
          label="Default workspace view"
          onChange={(event) => {
            setDraft((currentDraft) =>
              currentDraft
                ? {
                    ...currentDraft,
                    defaultWorkspaceView: event.target.value as UserPreferences['defaultWorkspaceView'],
                  }
                : currentDraft,
            );
          }}
          value={draft.defaultWorkspaceView}
        >
          <option value="inbox">Inbox</option>
          <option value="meetings">Meetings</option>
          <option value="search">Search</option>
        </SelectField>

        <SelectField
          label="Preferred meeting layout"
          onChange={(event) => {
            setDraft((currentDraft) =>
              currentDraft
                ? {
                    ...currentDraft,
                    preferredMeetingLayout: event.target.value as UserPreferences['preferredMeetingLayout'],
                  }
                : currentDraft,
            );
          }}
          value={draft.preferredMeetingLayout}
        >
          <option value="grid">Grid</option>
          <option value="spotlight">Spotlight</option>
        </SelectField>

        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            label="Locale override"
            onChange={(event) => {
              setDraft((currentDraft) =>
                currentDraft
                  ? {
                      ...currentDraft,
                      localeOverride: event.target.value,
                    }
                  : currentDraft,
              );
            }}
            value={draft.localeOverride ?? ''}
          />
          <TextField
            label="Time zone"
            onChange={(event) => {
              setDraft((currentDraft) =>
                currentDraft
                  ? {
                      ...currentDraft,
                      timeZone: event.target.value,
                    }
                  : currentDraft,
              );
            }}
            value={draft.timeZone ?? ''}
          />
        </div>

        <ToggleField
          checked={draft.compactModeEnabled}
          description="Optimizes density for high-volume inbox workflows."
          label="Compact mode"
          onChange={(compactModeEnabled) => {
            setDraft((currentDraft) =>
              currentDraft
                ? {
                    ...currentDraft,
                    compactModeEnabled,
                  }
                : currentDraft,
            );
          }}
        />
        <ToggleField
          checked={draft.keyboardShortcutsEnabled}
          description="Preserves keyboard-driven navigation as richer productivity features land."
          label="Keyboard shortcuts"
          onChange={(keyboardShortcutsEnabled) => {
            setDraft((currentDraft) =>
              currentDraft
                ? {
                    ...currentDraft,
                    keyboardShortcutsEnabled,
                  }
                : currentDraft,
            );
          }}
        />
        <ToggleField
          checked={draft.playSoundEffects}
          description="Applies to notification and meeting cue audio across devices."
          label="Play sound effects"
          onChange={(playSoundEffects) => {
            setDraft((currentDraft) =>
              currentDraft
                ? {
                    ...currentDraft,
                    playSoundEffects,
                  }
                : currentDraft,
            );
          }}
        />

        <div className="flex justify-end">
          <Button
            disabled={!dirty || updatePreferencesMutation.isPending}
            onClick={() => {
              void updatePreferencesMutation.mutateAsync({
                ...draft,
                localeOverride:
                  draft.localeOverride && draft.localeOverride.length > 0 ? draft.localeOverride : null,
                timeZone: draft.timeZone && draft.timeZone.length > 0 ? draft.timeZone : null,
              });
            }}
            size="sm"
          >
            {updatePreferencesMutation.isPending ? 'Saving preferences...' : 'Save preferences'}
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}
