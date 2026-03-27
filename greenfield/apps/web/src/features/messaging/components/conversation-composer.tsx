'use client';

import { Button, StatusBadge, Surface } from '@megaconvert/design-system';
import { CornerDownLeft, PencilLine, SendHorizontal, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { formatMessageTimestamp } from '../utils/presenters';

import type { Message } from '@megaconvert/contracts';
import type { KeyboardEvent } from 'react';

export interface ConversationComposerProps {
  body: string;
  isPending: boolean;
  mode: 'edit' | 'reply' | 'send';
  onBodyChange(value: string): void;
  onCancelAssist(): void;
  onStartTyping(): void;
  onStopTyping(): void;
  onSubmit(): void;
  referenceMessage: Message | null;
}

export function ConversationComposer({
  body,
  isPending,
  mode,
  onBodyChange,
  onCancelAssist,
  onStartTyping,
  onStopTyping,
  onSubmit,
  referenceMessage,
}: ConversationComposerProps) {
  const typingStopTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (typingStopTimerRef.current) {
        window.clearTimeout(typingStopTimerRef.current);
      }
    };
  }, []);

  function handleBodyChange(nextValue: string): void {
    onBodyChange(nextValue);

    if (nextValue.trim().length === 0) {
      onStopTyping();
      if (typingStopTimerRef.current) {
        window.clearTimeout(typingStopTimerRef.current);
      }
      return;
    }

    onStartTyping();

    if (typingStopTimerRef.current) {
      window.clearTimeout(typingStopTimerRef.current);
    }

    typingStopTimerRef.current = window.setTimeout(() => {
      onStopTyping();
    }, 1_200);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }

    event.preventDefault();

    if (body.trim().length === 0 || isPending) {
      return;
    }

    onSubmit();
  }

  return (
    <Surface className="grid gap-3 p-4 sm:p-5" tone="elevated">
      {referenceMessage ? (
        <div className="grid gap-2 rounded-[1.2rem] border border-outline-soft bg-panel/55 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {mode === 'edit' ? (
                <PencilLine className="h-4 w-4 text-accent" strokeWidth={1.8} />
              ) : (
                <CornerDownLeft className="h-4 w-4 text-accent" strokeWidth={1.8} />
              )}
              <p className="text-sm font-semibold tracking-[-0.03em] text-ink">
                {mode === 'edit'
                  ? 'Editing your message'
                  : `Replying to ${referenceMessage.author?.displayName ?? 'Unknown member'}`}
              </p>
            </div>
            <button
              className="rounded-full border border-outline-soft p-2 text-ink-subtle transition hover:bg-panel/80 hover:text-ink"
              onClick={onCancelAssist}
              type="button"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.8} />
            </button>
          </div>
          <p className="text-xs leading-6 text-ink-muted">
            {referenceMessage.body ?? 'Message unavailable'} ·{' '}
            {formatMessageTimestamp(referenceMessage.createdAt)}
          </p>
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <label className="grid gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">
            {mode === 'edit'
              ? 'Edit message'
              : mode === 'reply'
                ? 'Reply'
                : 'Compose'}
          </span>
          <textarea
            className="min-h-[8.5rem] rounded-[1.5rem] border border-outline-soft bg-panel/70 px-4 py-4 text-sm leading-7 text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--mc-color-accent)_18%,transparent)]"
            onBlur={onStopTyping}
            onChange={(event) => {
              handleBodyChange(event.target.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              mode === 'edit'
                ? 'Refine the message before saving the edit.'
                : 'Write a message. Press Enter to send, Shift+Enter for a new line.'
            }
            value={body}
          />
        </label>

        <div className="grid content-between gap-3">
          <div className="flex flex-wrap gap-2">
            <StatusBadge
              label={mode === 'edit' ? 'Editing' : mode === 'reply' ? 'Reply mode' : 'Drafting'}
              tone={mode === 'send' ? 'neutral' : 'accent'}
            />
            <StatusBadge label={`${body.trim().length}/4000`} tone="neutral" />
          </div>

          <div className="grid gap-2">
            <Button
              className="w-full justify-center"
              disabled={body.trim().length === 0 || isPending}
              onClick={onSubmit}
            >
              <SendHorizontal className="h-4.5 w-4.5" strokeWidth={1.8} />
              {mode === 'edit'
                ? isPending
                  ? 'Saving edit...'
                  : 'Save edit'
                : isPending
                  ? 'Sending...'
                  : 'Send message'}
            </Button>
            {mode !== 'send' ? (
              <Button className="w-full justify-center" onClick={onCancelAssist} tone="secondary">
                Cancel
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </Surface>
  );
}
