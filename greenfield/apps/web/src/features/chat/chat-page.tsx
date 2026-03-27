'use client';

import { Button, EmptyState, SectionCard, SkeletonBlock, StatusBadge } from '@megaconvert/design-system';
import { JsonClientError } from '@megaconvert/client-sdk';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useCurrentProfileQuery } from '@/features/profile/data/user-domain-hooks';
import { useAppServiceClients } from '@/providers/app-services-provider';
import { AuthRequiredState } from '@/features/shared/states/auth-required-state';
import { RouteErrorState } from '@/features/shared/states/route-error-state';
import { WorkspacePageFrame } from '@/features/shared/layout/workspace-page-frame';
import { AnimatedReveal } from '@/features/shared/motion/animated-reveal';

import { ConversationComposer } from '@/features/messaging/components/conversation-composer';
import { ConversationHeader } from '@/features/messaging/components/conversation-header';
import { ConversationMessageList } from '@/features/messaging/components/conversation-message-list';
import {
  useConversationDetailQuery,
  useConversationMessagesQuery,
  useDeleteMessageMutation,
  useEditMessageMutation,
  useSaveDraftMutation,
  useSendMessageMutation,
  useToggleReactionMutation,
  useUpdateReadStateMutation,
} from '@/features/messaging/data/messaging-hooks';
import { useConversationRealtime } from '@/features/messaging/realtime/use-conversation-realtime';

import type { Message } from '@megaconvert/contracts';

export interface ChatPageProps {
  conversationId: string;
}

export function ChatPage({ conversationId }: ChatPageProps) {
  const router = useRouter();
  const services = useAppServiceClients();
  const currentProfileQuery = useCurrentProfileQuery();
  const conversationDetailQuery = useConversationDetailQuery(conversationId);
  const messagesQuery = useConversationMessagesQuery(conversationId);
  const sendMessageMutation = useSendMessageMutation(conversationId);
  const editMessageMutation = useEditMessageMutation(conversationId);
  const deleteMessageMutation = useDeleteMessageMutation(conversationId);
  const toggleReactionMutation = useToggleReactionMutation(conversationId);
  const saveDraftMutation = useSaveDraftMutation(conversationId);
  const updateReadStateMutation = useUpdateReadStateMutation(conversationId);
  const [composerBody, setComposerBody] = useState('');
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [replyMessage, setReplyMessage] = useState<Message | null>(null);
  const syncedDraftKeyRef = useRef<string | null>(null);
  const requestedReadSequenceRef = useRef<number>(0);
  const flatMessages = messagesQuery.data?.flatMessages ?? [];
  const conversation = conversationDetailQuery.data;
  const realtimeState = useConversationRealtime(
    conversationId,
    conversation?.members.map((member) => member.user) ?? [],
  );

  useEffect(() => {
    syncedDraftKeyRef.current = null;
    requestedReadSequenceRef.current = 0;
    setComposerBody('');
    setEditingMessage(null);
    setReplyMessage(null);
  }, [conversationId]);

  useEffect(() => {
    if (!conversation || editingMessage) {
      return;
    }

    const nextDraftKey = `${conversationId}:${conversation.draft?.updatedAt ?? 'empty'}`;

    if (syncedDraftKeyRef.current === nextDraftKey) {
      return;
    }

    setComposerBody(conversation.draft?.body ?? '');

    if (conversation.draft?.replyToMessageId) {
      const matchedReplyMessage =
        flatMessages.find((message) => message.id === conversation.draft?.replyToMessageId) ?? null;
      setReplyMessage(matchedReplyMessage);
    } else {
      setReplyMessage(null);
    }

    syncedDraftKeyRef.current = nextDraftKey;
  }, [conversation, conversationId, editingMessage, flatMessages]);

  useEffect(() => {
    if (!conversation || editingMessage) {
      return;
    }

    const saveHandle = window.setTimeout(() => {
      void saveDraftMutation.mutateAsync({
        body: composerBody.trim().length > 0 ? composerBody : null,
        replyToMessageId: replyMessage?.id,
      });
    }, 500);

    return () => {
      window.clearTimeout(saveHandle);
    };
  }, [composerBody, conversation, editingMessage, replyMessage?.id, saveDraftMutation]);

  const latestMessageSequence = flatMessages.at(-1)?.sequence ?? 0;

  useEffect(() => {
    if (!conversation || latestMessageSequence === 0) {
      return;
    }

    if (latestMessageSequence <= conversation.viewer.lastReadSequence) {
      return;
    }

    if (latestMessageSequence <= requestedReadSequenceRef.current) {
      return;
    }

    requestedReadSequenceRef.current = latestMessageSequence;

    void updateReadStateMutation
      .mutateAsync({
        lastReadSequence: latestMessageSequence,
      })
      .catch(() => {
        requestedReadSequenceRef.current = 0;
      });
  }, [
    conversation,
    latestMessageSequence,
    updateReadStateMutation,
  ]);

  const currentUserId = currentProfileQuery.data?.id ?? null;
  const composerMode = editingMessage ? 'edit' : replyMessage ? 'reply' : 'send';
  const activeReferenceMessage = editingMessage ?? replyMessage;
  const sendingLabel = useMemo(() => {
    if (sendMessageMutation.isPending) {
      return 'Sending message...';
    }

    if (editMessageMutation.isPending) {
      return 'Saving edit...';
    }

    if (deleteMessageMutation.isPending) {
      return 'Updating timeline...';
    }

    return null;
  }, [
    deleteMessageMutation.isPending,
    editMessageMutation.isPending,
    sendMessageMutation.isPending,
  ]);

  if (conversationDetailQuery.isError || messagesQuery.isError) {
    const error = (conversationDetailQuery.error ?? messagesQuery.error) as Error;

    if (isSessionRequiredError(error)) {
      return (
        <WorkspacePageFrame
          description="The chat canvas becomes available as soon as the current session can access messaging routes."
          eyebrow="Chat"
          metadata={<StatusBadge label="Auth required" tone="warning" />}
          title="Conversation canvas"
        >
          <AuthRequiredState
            description="This chat requires an authenticated session before timeline data and composer actions can load."
            onRetry={() => {
              void Promise.all([
                conversationDetailQuery.refetch(),
                messagesQuery.refetch(),
              ]);
            }}
            title="Session required"
          />
        </WorkspacePageFrame>
      );
    }

    return (
      <WorkspacePageFrame
        description="The conversation could not be loaded from the messaging APIs."
        eyebrow="Chat"
        metadata={<StatusBadge label="Error" tone="warning" />}
        title="Conversation canvas"
      >
        <RouteErrorState
          description={error.message}
          onRetry={() => {
            void Promise.all([conversationDetailQuery.refetch(), messagesQuery.refetch()]);
          }}
          title="The chat failed to load."
        />
      </WorkspacePageFrame>
    );
  }

  if (conversationDetailQuery.isLoading || messagesQuery.isLoading || !conversation) {
    return <ConversationPageSkeleton />;
  }

  return (
    <WorkspacePageFrame
      description="This conversation is backed by the live messaging domain: paginated history, drafts, replies, reactions, read state, and realtime updates."
      eyebrow="Chat"
      metadata={<StatusBadge label="Live timeline" tone="success" />}
      title="Conversation canvas"
    >
      <div className="grid gap-4">
        <ConversationHeader
          connectionError={realtimeState.connectionError}
          connectionState={realtimeState.connectionState}
          conversation={conversation}
          onBack={() => {
            router.push('/inbox');
          }}
          presence={realtimeState.presence}
          typingParticipants={realtimeState.typingParticipants}
        />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <AnimatedReveal className="grid gap-4" delay={0.02}>
            <ConversationMessageList
              currentUserId={currentUserId}
              isLoading={false}
              messages={flatMessages}
              onDeleteMessage={(message) => {
                void deleteMessageMutation.mutateAsync(message.id);
              }}
              onEditMessage={(message) => {
                setReplyMessage(null);
                setEditingMessage(message);
                setComposerBody(message.body ?? '');
              }}
              onLoadEarlier={() => {
                void messagesQuery.fetchNextPage();
              }}
              onReplyToMessage={(message) => {
                setEditingMessage(null);
                setReplyMessage(message);
              }}
              onToggleReaction={(message, reaction, reactedByViewer) => {
                void toggleReactionMutation.mutateAsync({
                  messageId: message.id,
                  reactedByViewer,
                  reaction,
                });
              }}
              reactionBusy={toggleReactionMutation.isPending}
              sendingStateLabel={sendingLabel}
              showLoadEarlier={messagesQuery.hasNextPage}
            />

            <ConversationComposer
              body={composerBody}
              isPending={sendMessageMutation.isPending || editMessageMutation.isPending}
              mode={composerMode}
              onBodyChange={setComposerBody}
              onCancelAssist={() => {
                setEditingMessage(null);
                setReplyMessage(null);
                setComposerBody('');
              }}
              onStartTyping={() => {
                void services.messagingRealtime.typingStart(conversationId).catch(() => undefined);
              }}
              onStopTyping={() => {
                void services.messagingRealtime.typingStop(conversationId).catch(() => undefined);
              }}
              onSubmit={async () => {
                const trimmedBody = composerBody.trim();

                if (trimmedBody.length === 0) {
                  return;
                }

                if (editingMessage) {
                  await editMessageMutation.mutateAsync({
                    input: {
                      body: trimmedBody,
                    },
                    messageId: editingMessage.id,
                  });
                } else {
                  await sendMessageMutation.mutateAsync({
                    body: trimmedBody,
                    clientRequestId:
                      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                        ? crypto.randomUUID()
                        : undefined,
                    replyToMessageId: replyMessage?.id,
                  });
                }

                setComposerBody('');
                setEditingMessage(null);
                setReplyMessage(null);
                await saveDraftMutation.mutateAsync({
                  body: null,
                  replyToMessageId: null,
                });
                void services.messagingRealtime.typingStop(conversationId).catch(() => undefined);
              }}
              referenceMessage={activeReferenceMessage}
            />
          </AnimatedReveal>

          <AnimatedReveal delay={0.05}>
            <div className="grid gap-4">
              <SectionCard
                description="Member roles and pinned-message foundations are part of the live conversation detail response."
                eyebrow="Context rail"
                title="Room structure"
              >
                <div className="grid gap-3 text-sm leading-6 text-ink-muted">
                  {conversation.members.map((member) => (
                    <div
                      className="rounded-[1.2rem] border border-outline-soft bg-panel/55 px-4 py-3"
                      key={member.user.id}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-ink">{member.user.displayName}</p>
                          <p className="text-xs uppercase tracking-[0.12em] text-ink-subtle">
                            @{member.user.username}
                          </p>
                        </div>
                        <StatusBadge label={member.role} tone="neutral" />
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard
                description="Pinned messages are wired into the conversation detail model and ready for mutation endpoints next."
                eyebrow="Pinned"
                title="Pinned message foundation"
              >
                {conversation.pinnedMessages.length > 0 ? (
                  <div className="grid gap-3">
                    {conversation.pinnedMessages.map((pinnedMessage) => (
                      <div
                        className="rounded-[1.2rem] border border-outline-soft bg-panel/55 px-4 py-3 text-sm leading-6 text-ink-muted"
                        key={pinnedMessage.message.id}
                      >
                        <p className="font-semibold text-ink">
                          {pinnedMessage.message.author?.displayName ?? 'System'}
                        </p>
                        <p>{pinnedMessage.message.bodyPreview ?? 'Pinned message unavailable.'}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="No pinned messages yet">
                    <p>This room is ready for pinned-message commands once that mutation surface lands.</p>
                  </EmptyState>
                )}
              </SectionCard>
            </div>
          </AnimatedReveal>
        </div>
      </div>
    </WorkspacePageFrame>
  );
}

function ConversationPageSkeleton() {
  return (
    <WorkspacePageFrame
      description="Loading the conversation header, timeline, and composer."
      eyebrow="Chat"
      metadata={<StatusBadge label="Loading" tone="neutral" />}
      title="Conversation canvas"
    >
      <div className="grid gap-4">
        <SectionCard description="Preparing room metadata" eyebrow="Chat" title="Conversation">
          <div className="grid gap-3">
            <SkeletonBlock className="h-12 w-[42%]" />
            <SkeletonBlock className="h-4 w-[70%]" />
          </div>
        </SectionCard>
        <SectionCard description="Loading timeline" eyebrow="Messages" title="Timeline">
          <div className="grid gap-3">
            <SkeletonBlock className="h-24 rounded-[1.6rem]" />
            <SkeletonBlock className="h-28 rounded-[1.6rem]" />
            <SkeletonBlock className="h-20 rounded-[1.6rem]" />
          </div>
        </SectionCard>
      </div>
    </WorkspacePageFrame>
  );
}

function isSessionRequiredError(error: unknown): boolean {
  return error instanceof JsonClientError && (error.statusCode === 401 || error.statusCode === 403);
}
