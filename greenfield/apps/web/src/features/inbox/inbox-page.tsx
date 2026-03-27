'use client';

import { Button, EmptyState, ErrorState, SectionCard, SkeletonBlock, StatusBadge } from '@megaconvert/design-system';
import { JsonClientError } from '@megaconvert/client-sdk';
import { useRouter } from 'next/navigation';

import { CreateConversationCard } from '@/features/messaging/components/create-conversation-card';
import { ChatList } from '@/features/messaging/components/chat-list';
import { useConversationListQuery } from '@/features/messaging/data/messaging-hooks';
import { AuthRequiredState } from '@/features/shared/states/auth-required-state';
import { WorkspacePageFrame } from '@/features/shared/layout/workspace-page-frame';

export function InboxPage() {
  const router = useRouter();
  const conversationsQuery = useConversationListQuery();

  if (conversationsQuery.isError) {
    if (isSessionRequiredError(conversationsQuery.error)) {
      return (
        <WorkspacePageFrame
          description="Messaging APIs are protected by the current user session. Sign-in will activate this inbox without changing the route structure."
          eyebrow="Inbox"
          metadata={<StatusBadge label="Auth required" tone="warning" />}
          title="Conversation index"
        >
          <AuthRequiredState
            description="The inbox needs an authenticated session before conversations can be listed."
            onRetry={() => {
              void conversationsQuery.refetch();
            }}
            title="Session required"
          />
        </WorkspacePageFrame>
      );
    }

    return (
      <WorkspacePageFrame
        description="The conversation list could not be loaded from the messaging API."
        eyebrow="Inbox"
        metadata={<StatusBadge label="Connection issue" tone="warning" />}
        title="Conversation index"
      >
        <SectionCard
          description="Retry once the API is reachable again."
          eyebrow="Failure"
          title="Inbox unavailable"
        >
          <ErrorState
            action={
              <Button
                onClick={() => {
                  void conversationsQuery.refetch();
                }}
                tone="secondary"
              >
                Retry
              </Button>
            }
            title="The inbox request failed"
          >
            <p>{conversationsQuery.error.message}</p>
          </ErrorState>
        </SectionCard>
      </WorkspacePageFrame>
    );
  }

  if (conversationsQuery.isLoading) {
    return (
      <WorkspacePageFrame
        description="Preparing the conversation index, unread counters, and creation surfaces."
        eyebrow="Inbox"
        metadata={<StatusBadge label="Loading" tone="neutral" />}
        title="Conversation index"
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
          <SectionCard
            description="Loading conversations"
            eyebrow="Inbox"
            title="Recent rooms"
          >
            <div className="grid gap-3">
              <SkeletonBlock className="h-28 rounded-[1.7rem]" />
              <SkeletonBlock className="h-28 rounded-[1.7rem]" />
              <SkeletonBlock className="h-28 rounded-[1.7rem]" />
            </div>
          </SectionCard>

          <SectionCard
            description="Preparing creation controls"
            eyebrow="Compose"
            title="Start a conversation"
          >
            <div className="grid gap-3">
              <SkeletonBlock className="h-12 rounded-[1rem]" />
              <SkeletonBlock className="h-32 rounded-[1.4rem]" />
              <SkeletonBlock className="h-12 rounded-[1rem]" />
            </div>
          </SectionCard>
        </div>
      </WorkspacePageFrame>
    );
  }

  const conversations = conversationsQuery.data?.conversations ?? [];

  return (
    <WorkspacePageFrame
      description="Direct and group conversations now come from the live messaging API, including unread counters, previews, drafts, and role-aware metadata."
      eyebrow="Inbox"
      metadata={<StatusBadge label="Live messaging" tone="success" />}
      title="Conversation index and room creation"
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
        <SectionCard
          description="Recent conversations are sorted by activity and carry unread, draft, and pinned-message cues."
          eyebrow="Recent rooms"
          title="Inbox"
        >
          {conversations.length > 0 ? (
            <ChatList conversations={conversations} />
          ) : (
            <EmptyState title="No conversations yet">
              <p>Create a direct or group conversation to start the messaging graph.</p>
            </EmptyState>
          )}
        </SectionCard>

        <div className="grid gap-4">
          <CreateConversationCard
            onConversationCreated={(conversationId) => {
              router.push(`/chats/${conversationId}`);
            }}
          />

          <SectionCard
            description="These behaviors are already backed by database state and API contracts."
            eyebrow="Foundations"
            title="What is live now"
          >
            <div className="flex flex-wrap gap-2">
              <StatusBadge label="Direct chats" tone="accent" />
              <StatusBadge label="Group chats" tone="accent" />
              <StatusBadge label="Unread counters" tone="accent" />
              <StatusBadge label="Drafts" tone="neutral" />
              <StatusBadge label="Member roles" tone="neutral" />
              <StatusBadge label="Pinned foundations" tone="neutral" />
            </div>
          </SectionCard>
        </div>
      </div>
    </WorkspacePageFrame>
  );
}

function isSessionRequiredError(error: unknown): boolean {
  return error instanceof JsonClientError && (error.statusCode === 401 || error.statusCode === 403);
}
