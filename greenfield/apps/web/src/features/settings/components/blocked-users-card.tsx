'use client';

import { Button, ErrorState, SectionCard, SkeletonBlock } from '@megaconvert/design-system';
import { useState } from 'react';

import { ProfileCard } from '@/features/profile/components/profile-card';
import {
  useBlockedUsersQuery,
  useBlockUserMutation,
  useUnblockUserMutation,
} from '@/features/profile/data/user-domain-hooks';
import { TextField } from '@/features/shared/forms/form-controls';

export function BlockedUsersCard() {
  const blockedUsersQuery = useBlockedUsersQuery();
  const blockUserMutation = useBlockUserMutation();
  const unblockUserMutation = useUnblockUserMutation();
  const [username, setUsername] = useState('');
  const [note, setNote] = useState('');
  const blockedUsers = blockedUsersQuery.data?.blockedUsers ?? [];

  if (blockedUsersQuery.isLoading) {
    return (
      <SectionCard eyebrow="Safety" title="Blocked users">
        <div className="grid gap-4">
          <SkeletonBlock className="h-16 rounded-[1rem]" />
          <SkeletonBlock className="h-24 rounded-[1.25rem]" />
        </div>
      </SectionCard>
    );
  }

  if (blockedUsersQuery.isError) {
    return (
      <SectionCard eyebrow="Safety" title="Blocked users">
        <ErrorState
          action={
            <Button onClick={() => blockedUsersQuery.refetch()} size="sm" tone="secondary">
              Retry
            </Button>
          }
          title="Blocked users are unavailable"
        >
          <p className="text-sm leading-6 text-ink-muted">
            The block list could not be loaded for the current user session.
          </p>
        </ErrorState>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      description="This is the account-level safety foundation that messaging and meetings can respect later."
      eyebrow="Safety"
      title="Blocked users"
    >
      <div className="grid gap-4">
        <div className="grid gap-4 rounded-[1.3rem] border border-outline-soft bg-panel/55 p-4">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
            <TextField
              description="Use the canonical username handle."
              label="Block by username"
              onChange={(event) => {
                setUsername(event.target.value);
              }}
              placeholder="username"
              value={username}
            />
            <TextField
              description="Optional internal note for why this account is blocked."
              label="Note"
              onChange={(event) => {
                setNote(event.target.value);
              }}
              placeholder="Reason"
              value={note}
            />
          </div>
          {blockUserMutation.isError ? (
            <div className="rounded-[1rem] border border-danger/20 bg-danger/6 px-4 py-3 text-sm leading-6 text-danger">
              {(blockUserMutation.error as Error).message}
            </div>
          ) : null}
          <div className="flex justify-end">
            <Button
              disabled={username.trim().length === 0 || blockUserMutation.isPending}
              onClick={() => {
                void blockUserMutation
                  .mutateAsync({
                    note: note.trim().length > 0 ? note : null,
                    username: username.trim().toLowerCase(),
                  })
                  .then(() => {
                    setNote('');
                    setUsername('');
                  });
              }}
              size="sm"
            >
              {blockUserMutation.isPending ? 'Blocking...' : 'Block user'}
            </Button>
          </div>
        </div>

        {blockedUsers.length === 0 ? (
          <div className="rounded-[1.25rem] border border-dashed border-outline-soft bg-panel/40 px-4 py-5 text-sm leading-7 text-ink-muted">
            No blocked users are currently stored for this account.
          </div>
        ) : (
          <div className="grid gap-3">
            {blockedUsers.map((blockedUser) => (
              <div
                key={blockedUser.id}
                className="grid gap-3 rounded-[1.25rem] border border-outline-soft bg-panel/50 p-3"
              >
                <ProfileCard
                  accentLabel="Blocked"
                  profile={blockedUser.user}
                  subtitle={blockedUser.note ?? 'No internal note recorded.'}
                />
                <div className="flex justify-between gap-3 px-1 text-xs uppercase tracking-[0.16em] text-ink-subtle">
                  <span>Blocked {new Date(blockedUser.blockedAt).toLocaleDateString()}</span>
                  <Button
                    onClick={() => {
                      void unblockUserMutation.mutateAsync(blockedUser.user.id);
                    }}
                    size="sm"
                    tone="secondary"
                  >
                    {unblockUserMutation.isPending ? 'Updating...' : 'Unblock'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
