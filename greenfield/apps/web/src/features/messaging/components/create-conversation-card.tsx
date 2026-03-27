'use client';

import { Button, SectionCard } from '@megaconvert/design-system';
import { useState } from 'react';

import { TextAreaField, TextField } from '@/features/shared/forms/form-controls';

import {
  useCreateDirectConversationMutation,
  useCreateGroupConversationMutation,
} from '../data/messaging-hooks';

export interface CreateConversationCardProps {
  onConversationCreated(conversationId: string): void;
}

export function CreateConversationCard({
  onConversationCreated,
}: CreateConversationCardProps) {
  const createDirectConversationMutation = useCreateDirectConversationMutation();
  const createGroupConversationMutation = useCreateGroupConversationMutation();
  const [mode, setMode] = useState<'direct' | 'group'>('direct');
  const [directUsername, setDirectUsername] = useState('');
  const [groupTitle, setGroupTitle] = useState('');
  const [groupMembers, setGroupMembers] = useState('');

  const activeError =
    (createDirectConversationMutation.error as Error | null) ??
    (createGroupConversationMutation.error as Error | null);
  const busy =
    createDirectConversationMutation.isPending || createGroupConversationMutation.isPending;

  return (
    <SectionCard
      description="Start a direct or group conversation through the live messaging APIs."
      eyebrow="New conversation"
      title="Create a room"
    >
      <div className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              setMode('direct');
            }}
            size="sm"
            tone={mode === 'direct' ? 'primary' : 'secondary'}
          >
            Direct chat
          </Button>
          <Button
            onClick={() => {
              setMode('group');
            }}
            size="sm"
            tone={mode === 'group' ? 'primary' : 'secondary'}
          >
            Group chat
          </Button>
        </div>

        {mode === 'direct' ? (
          <div className="grid gap-3">
            <TextField
              description="Use the exact username for the participant you want to reach."
              label="Participant username"
              onChange={(event) => {
                setDirectUsername(event.target.value.toLowerCase());
              }}
              placeholder="jamila"
              value={directUsername}
            />
            <div className="flex justify-end">
              <Button
                disabled={busy || directUsername.trim().length === 0}
                onClick={async () => {
                  const conversation =
                    await createDirectConversationMutation.mutateAsync({
                      participantUsername: directUsername.trim().toLowerCase(),
                    });
                  setDirectUsername('');
                  onConversationCreated(conversation.id);
                }}
                size="sm"
              >
                {createDirectConversationMutation.isPending ? 'Creating...' : 'Open chat'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            <TextField
              description="Group titles become the primary label across inbox and chat."
              label="Group title"
              onChange={(event) => {
                setGroupTitle(event.target.value);
              }}
              placeholder="Launch crew"
              value={groupTitle}
            />
            <TextAreaField
              description="Separate member usernames with commas."
              label="Member usernames"
              onChange={(event) => {
                setGroupMembers(event.target.value.toLowerCase());
              }}
              placeholder="jamila, isaac, priya"
              rows={3}
              value={groupMembers}
            />
            <div className="flex justify-end">
              <Button
                disabled={
                  busy ||
                  groupTitle.trim().length === 0 ||
                  splitUsernames(groupMembers).length === 0
                }
                onClick={async () => {
                  const conversation =
                    await createGroupConversationMutation.mutateAsync({
                      memberUsernames: splitUsernames(groupMembers),
                      title: groupTitle.trim(),
                    });
                  setGroupMembers('');
                  setGroupTitle('');
                  onConversationCreated(conversation.id);
                }}
                size="sm"
              >
                {createGroupConversationMutation.isPending ? 'Creating...' : 'Create group'}
              </Button>
            </div>
          </div>
        )}

        {activeError ? (
          <div className="rounded-[1.1rem] border border-danger/20 bg-danger/6 px-4 py-3 text-sm leading-6 text-danger">
            {activeError.message}
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}

function splitUsernames(value: string): string[] {
  return [...new Set(value.split(',').map((username) => username.trim()).filter(Boolean))];
}
