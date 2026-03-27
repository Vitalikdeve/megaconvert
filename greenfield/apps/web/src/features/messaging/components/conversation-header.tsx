'use client';

import { Button, SectionCard, StatusBadge } from '@megaconvert/design-system';
import { ArrowLeft, Signal, UsersRound, WifiOff } from 'lucide-react';

import {
  getConversationLabel,
  getConversationSupportingText,
  getTypingSummary,
} from '../utils/presenters';

import type {
  ConversationDetail,
  ConversationPresenceEvent,
  UserProfileCard,
} from '@megaconvert/contracts';

export interface ConversationHeaderProps {
  connectionError: string | null;
  connectionState: 'connected' | 'connecting' | 'error' | 'idle';
  conversation: ConversationDetail;
  onBack(): void;
  presence: ConversationPresenceEvent | null;
  typingParticipants: readonly UserProfileCard[];
}

export function ConversationHeader({
  connectionError,
  connectionState,
  conversation,
  onBack,
  presence,
  typingParticipants,
}: ConversationHeaderProps) {
  const typingSummary = getTypingSummary(typingParticipants);

  return (
    <SectionCard
      description={typingSummary ?? getConversationSupportingText(conversation)}
      eyebrow="Conversation"
      title={getConversationLabel(conversation)}
    >
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button className="sm:hidden" onClick={onBack} size="sm" tone="secondary">
            <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
            Back
          </Button>
          <StatusBadge label={conversation.kind} tone="accent" />
          <StatusBadge label={`${conversation.viewer.role} access`} tone="neutral" />
          <StatusBadge
            label={
              presence ? `${presence.activeCount} active` : `${conversation.memberCount} members`
            }
            tone="neutral"
          />
          {conversation.pinnedMessages.length > 0 ? (
            <StatusBadge
              label={`${conversation.pinnedMessages.length} pinned`}
              tone="warning"
            />
          ) : null}
          <StatusBadge
            label={
              connectionState === 'connected'
                ? 'Live'
                : connectionState === 'connecting'
                  ? 'Connecting'
                  : 'Offline'
            }
            tone={connectionState === 'connected' ? 'success' : 'warning'}
          />
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="grid gap-2 text-sm leading-6 text-ink-muted">
            {typingSummary ? <p className="text-accent">{typingSummary}</p> : null}
            {connectionState === 'error' ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-warning/20 bg-warning/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-warning">
                <WifiOff className="h-3.5 w-3.5" strokeWidth={1.8} />
                {connectionError ?? 'Realtime updates are unavailable.'}
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-subtle">
                <Signal className="h-3.5 w-3.5" strokeWidth={1.8} />
                {presence
                  ? `${presence.activeCount} active participant${presence.activeCount === 1 ? '' : 's'} in this room`
                  : 'Presence activates when members join the room'}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-subtle">
            <UsersRound className="h-4 w-4" strokeWidth={1.8} />
            {conversation.members.map((member) => member.user.displayName).slice(0, 3).join(' · ')}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
