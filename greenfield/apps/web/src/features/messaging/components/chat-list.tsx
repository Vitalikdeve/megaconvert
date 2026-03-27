'use client';

import { StatusBadge, Surface } from '@megaconvert/design-system';
import { ChevronRight, MessageSquareText, Pin } from 'lucide-react';
import Link from 'next/link';

import {
  formatConversationTimestamp,
  getConversationLabel,
  getConversationPreview,
  getConversationSupportingText,
} from '../utils/presenters';

import type { PaginatedConversations } from '@megaconvert/contracts';

export interface ChatListProps {
  activeConversationId?: string | null;
  conversations: PaginatedConversations['conversations'];
}

export function ChatList({ activeConversationId = null, conversations }: ChatListProps) {
  return (
    <div className="grid gap-3">
      {conversations.map((conversation) => {
        const active = conversation.id === activeConversationId;

        return (
          <Link href={`/chats/${conversation.id}`} key={conversation.id}>
            <Surface
              className={`group grid gap-3 p-4 transition duration-200 ${
                active
                  ? 'border-accent/30 bg-[color:color-mix(in_srgb,var(--mc-color-accent-soft)_56%,transparent)]'
                  : 'hover:border-outline-strong hover:bg-surface/92'
              }`}
              tone={active ? 'elevated' : 'default'}
            >
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[1.15rem] bg-[var(--mc-color-accent-soft)] text-accent">
                  <MessageSquareText className="h-5 w-5" strokeWidth={1.8} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold tracking-[-0.03em] text-ink">
                        {getConversationLabel(conversation)}
                      </p>
                      <p className="truncate text-xs leading-6 text-ink-subtle">
                        {getConversationSupportingText(conversation)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {conversation.viewer.unreadCount > 0 ? (
                        <span className="grid min-w-[1.7rem] place-items-center rounded-full bg-accent px-2 py-1 text-[0.7rem] font-bold text-white">
                          {Math.min(conversation.viewer.unreadCount, 99)}
                        </span>
                      ) : null}
                      <span className="whitespace-nowrap text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
                        {formatConversationTimestamp(conversation.lastActivityAt)}
                      </span>
                    </div>
                  </div>

                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink-muted">
                    {getConversationPreview(conversation)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge label={conversation.kind} tone="neutral" />
                  <StatusBadge label={conversation.viewer.role} tone="neutral" />
                  {conversation.pinnedMessageCount > 0 ? (
                    <StatusBadge
                      label={`${conversation.pinnedMessageCount} pinned`}
                      tone="warning"
                    />
                  ) : null}
                  {conversation.draft ? <StatusBadge label="Draft" tone="accent" /> : null}
                </div>

                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-subtle">
                  {conversation.pinnedMessageCount > 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <Pin className="h-3.5 w-3.5" strokeWidth={1.8} />
                      Foundation
                    </span>
                  ) : null}
                  <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </div>
              </div>
            </Surface>
          </Link>
        );
      })}
    </div>
  );
}
