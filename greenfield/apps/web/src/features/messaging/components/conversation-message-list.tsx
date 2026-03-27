'use client';

import { Button, EmptyState, SkeletonBlock, StatusBadge, Surface } from '@megaconvert/design-system';
import { CornerDownLeft, PencilLine, SmilePlus, Trash2 } from 'lucide-react';

import { formatMessageTimestamp, getMessageAuthorLabel, isOwnMessage } from '../utils/presenters';

import type { Message } from '@megaconvert/contracts';

const quickReactionValues = ['👍', '❤️', '🔥', '👏'] as const;

export interface ConversationMessageListProps {
  currentUserId: string | null;
  isLoading: boolean;
  messages: readonly Message[];
  onDeleteMessage(message: Message): void;
  onEditMessage(message: Message): void;
  onLoadEarlier?(): void;
  onReplyToMessage(message: Message): void;
  onToggleReaction(message: Message, reaction: string, reactedByViewer: boolean): void;
  reactionBusy: boolean;
  sendingStateLabel?: string | null;
  showLoadEarlier: boolean;
}

export function ConversationMessageList({
  currentUserId,
  isLoading,
  messages,
  onDeleteMessage,
  onEditMessage,
  onLoadEarlier,
  onReplyToMessage,
  onToggleReaction,
  reactionBusy,
  sendingStateLabel = null,
  showLoadEarlier,
}: ConversationMessageListProps) {
  if (isLoading) {
    return (
      <Surface className="grid gap-4 p-4 sm:p-5" tone="default">
        <MessageSkeleton own={false} />
        <MessageSkeleton own={true} />
        <MessageSkeleton own={false} />
      </Surface>
    );
  }

  if (messages.length === 0) {
    return (
      <Surface className="p-4 sm:p-5" tone="default">
        <EmptyState title="No messages yet">
          <p>Start this room with a first message, a reply, or a kickoff note.</p>
        </EmptyState>
      </Surface>
    );
  }

  return (
    <Surface className="grid min-h-[28rem] gap-4 p-4 sm:p-5" tone="default">
      {showLoadEarlier ? (
        <div className="flex justify-center">
          <Button onClick={onLoadEarlier} size="sm" tone="secondary">
            Load earlier messages
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4">
        {messages.map((message) => {
          if (message.kind === 'system') {
            return (
              <div
                className="flex justify-center"
                key={message.id}
              >
                <div className="max-w-[38rem] rounded-full border border-outline-soft bg-panel/60 px-4 py-2 text-center text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">
                  {message.systemMetadata?.eventType === 'conversation_created'
                    ? message.body ?? 'Conversation created'
                    : message.body ?? 'System event'}
                </div>
              </div>
            );
          }

          const ownMessage = isOwnMessage(message, currentUserId);

          return (
            <article
              className={`flex ${ownMessage ? 'justify-end' : 'justify-start'}`}
              key={message.id}
            >
              <div
                className={`grid max-w-[min(100%,44rem)] gap-2 rounded-[1.65rem] border px-4 py-3 shadow-soft ${
                  ownMessage
                    ? 'border-accent/20 bg-[color:color-mix(in_srgb,var(--mc-color-accent-soft)_38%,white)]'
                    : 'border-outline-soft bg-surface/86'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold tracking-[-0.03em] text-ink">
                    {getMessageAuthorLabel(message, currentUserId)}
                  </p>
                  <span className="text-xs uppercase tracking-[0.12em] text-ink-subtle">
                    {formatMessageTimestamp(message.createdAt)}
                  </span>
                  {message.editedAt ? <StatusBadge label="Edited" tone="neutral" /> : null}
                  {message.status === 'deleted' ? <StatusBadge label="Deleted" tone="warning" /> : null}
                </div>

                {message.replyToMessage ? (
                  <div className="rounded-[1rem] border border-outline-soft bg-panel/55 px-3 py-2 text-xs leading-6 text-ink-muted">
                    <p className="font-semibold text-ink">
                      Replying to {message.replyToMessage.author?.displayName ?? 'Unknown member'}
                    </p>
                    <p>{message.replyToMessage.bodyPreview ?? 'Original message unavailable.'}</p>
                  </div>
                ) : null}

                <p className="whitespace-pre-wrap break-words text-sm leading-7 text-ink">
                  {message.body ?? 'This message was removed.'}
                </p>

                {message.reactions.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {message.reactions.map((reaction) => (
                      <button
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                          reaction.reactedByViewer
                            ? 'border-accent/20 bg-accent-soft text-accent'
                            : 'border-outline-soft bg-panel/55 text-ink-muted'
                        }`}
                        disabled={reactionBusy}
                        key={`${message.id}:${reaction.value}`}
                        onClick={() => {
                          onToggleReaction(message, reaction.value, reaction.reactedByViewer);
                        }}
                        type="button"
                      >
                        <span>{reaction.value}</span>
                        <span>{reaction.count}</span>
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-subtle">
                  <Button
                    className="!min-h-0 !rounded-full !px-3 !py-2"
                    onClick={() => {
                      onReplyToMessage(message);
                    }}
                    size="sm"
                    tone="ghost"
                  >
                    <CornerDownLeft className="h-3.5 w-3.5" strokeWidth={1.8} />
                    Reply
                  </Button>

                  {quickReactionValues.map((reactionValue) => {
                    const activeReaction = message.reactions.find(
                      (reaction) => reaction.value === reactionValue,
                    );

                    return (
                      <button
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[0.72rem] font-semibold transition ${
                          activeReaction?.reactedByViewer
                            ? 'border-accent/20 bg-accent-soft text-accent'
                            : 'border-outline-soft bg-panel/50 text-ink-muted'
                        }`}
                        disabled={reactionBusy}
                        key={`${message.id}:quick:${reactionValue}`}
                        onClick={() => {
                          onToggleReaction(
                            message,
                            reactionValue,
                            activeReaction?.reactedByViewer ?? false,
                          );
                        }}
                        type="button"
                      >
                        <SmilePlus className="h-3 w-3" strokeWidth={1.8} />
                        {reactionValue}
                      </button>
                    );
                  })}

                  {ownMessage && message.status !== 'deleted' ? (
                    <>
                      <Button
                        className="!min-h-0 !rounded-full !px-3 !py-2"
                        onClick={() => {
                          onEditMessage(message);
                        }}
                        size="sm"
                        tone="ghost"
                      >
                        <PencilLine className="h-3.5 w-3.5" strokeWidth={1.8} />
                        Edit
                      </Button>
                      <Button
                        className="!min-h-0 !rounded-full !px-3 !py-2"
                        onClick={() => {
                          onDeleteMessage(message);
                        }}
                        size="sm"
                        tone="ghost"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                        Delete
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {sendingStateLabel ? (
        <div className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">
          {sendingStateLabel}
        </div>
      ) : null}
    </Surface>
  );
}

function MessageSkeleton({ own }: { own: boolean }) {
  return (
    <div className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
      <div className="grid max-w-[28rem] gap-3 rounded-[1.65rem] border border-outline-soft bg-surface/82 px-4 py-4">
        <SkeletonBlock className="h-4 w-28" />
        <SkeletonBlock className="h-4 w-full rounded-[0.8rem]" />
        <SkeletonBlock className="h-4 w-[72%] rounded-[0.8rem]" />
      </div>
    </div>
  );
}
