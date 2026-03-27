'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useCurrentProfileQuery } from '@/features/profile/data/user-domain-hooks';
import { useAppServiceClients } from '@/providers/app-services-provider';

import { invalidateConversationState, upsertMessageInCache } from '../data/messaging-hooks';
import { messagingQueryKeys } from '../data/messaging-query-keys';

import type { ConversationPresenceEvent, TypingUpdatedEvent, UserProfileCard } from '@megaconvert/contracts';

type RealtimeConnectionState = 'connected' | 'connecting' | 'error' | 'idle';

export interface ConversationRealtimeState {
  connectionError: string | null;
  connectionState: RealtimeConnectionState;
  presence: ConversationPresenceEvent | null;
  typingParticipants: UserProfileCard[];
}

export function useConversationRealtime(
  conversationId: string,
  counterpartProfiles: readonly UserProfileCard[],
): ConversationRealtimeState {
  const services = useAppServiceClients();
  const queryClient = useQueryClient();
  const currentProfileQuery = useCurrentProfileQuery();
  const [connectionState, setConnectionState] = useState<RealtimeConnectionState>('idle');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [presence, setPresence] = useState<ConversationPresenceEvent | null>(null);
  const [typingState, setTypingState] = useState<Record<string, string>>({});

  useEffect(() => {
    const cleanupCallbacks: Array<() => void> = [];
    let isDisposed = false;

    async function connectRealtime() {
      setConnectionState('connecting');
      setConnectionError(null);

      cleanupCallbacks.push(
        services.messagingRealtime.onEvent('messaging.conversation.presence.updated', (event) => {
          if (event.conversationId === conversationId) {
            setPresence(event);
          }
        }),
        services.messagingRealtime.onEvent('messaging.inbox.changed', (event) => {
          void queryClient.invalidateQueries({
            queryKey: messagingQueryKeys.conversationsRoot,
          });

          if (event.conversationId === conversationId) {
            void queryClient.invalidateQueries({
              queryKey: messagingQueryKeys.conversation(conversationId),
            });
          }
        }),
        services.messagingRealtime.onEvent('messaging.message.created', (event) => {
          if (event.conversationId !== conversationId) {
            void queryClient.invalidateQueries({
              queryKey: messagingQueryKeys.conversationsRoot,
            });
            return;
          }

          upsertMessageInCache(queryClient, conversationId, event.message, 'append');
          void invalidateConversationState(queryClient, conversationId);
        }),
        services.messagingRealtime.onEvent('messaging.message.updated', (event) => {
          if (event.conversationId !== conversationId) {
            return;
          }

          upsertMessageInCache(queryClient, conversationId, event.message, 'replace');
          void invalidateConversationState(queryClient, conversationId);
        }),
        services.messagingRealtime.onEvent('messaging.message.deleted', (event) => {
          if (event.conversationId !== conversationId) {
            return;
          }

          upsertMessageInCache(queryClient, conversationId, event.message, 'replace');
          void invalidateConversationState(queryClient, conversationId);
        }),
        services.messagingRealtime.onEvent('messaging.read-state.updated', (event) => {
          if (event.conversationId === conversationId) {
            void queryClient.invalidateQueries({
              queryKey: messagingQueryKeys.conversation(conversationId),
            });
          }

          void queryClient.invalidateQueries({
            queryKey: messagingQueryKeys.conversationsRoot,
          });
        }),
        services.messagingRealtime.onEvent('messaging.typing.updated', (event) => {
          if (event.conversationId !== conversationId) {
            return;
          }

          setTypingState((currentState) => applyTypingEvent(currentState, event));
        }),
        services.messagingRealtime.onDisconnect(() => {
          if (!isDisposed) {
            setConnectionState('idle');
          }
        }),
        services.messagingRealtime.onConnectError((error) => {
          if (!isDisposed) {
            setConnectionState('error');
            setConnectionError(error.message);
          }
        }),
      );

      try {
        await services.messagingRealtime.connect();
        const ack = await services.messagingRealtime.subscribe(conversationId);

        if (!ack.ok) {
          throw new Error(ack.code ?? 'Conversation subscription was rejected.');
        }

        if (!isDisposed) {
          setConnectionState('connected');
          setConnectionError(null);
        }
      } catch (error) {
        if (!isDisposed) {
          setConnectionState('error');
          setConnectionError(error instanceof Error ? error.message : 'Realtime connection failed.');
        }
      }
    }

    void connectRealtime();

    return () => {
      isDisposed = true;

      void services.messagingRealtime
        .typingStop(conversationId)
        .catch(() => undefined);
      void services.messagingRealtime
        .unsubscribe(conversationId)
        .catch(() => undefined);
      services.messagingRealtime.disconnect();
      cleanupCallbacks.forEach((cleanup) => cleanup());
      setPresence(null);
      setTypingState({});
    };
  }, [conversationId, queryClient, services.messagingRealtime]);

  useEffect(() => {
    if (Object.keys(typingState).length === 0) {
      return;
    }

    const intervalHandle = window.setInterval(() => {
      setTypingState((currentState) => pruneTypingState(currentState));
    }, 1_000);

    return () => {
      window.clearInterval(intervalHandle);
    };
  }, [typingState]);

  const typingParticipants = useMemo(() => {
    const currentUserId = currentProfileQuery.data?.id ?? null;
    const activeTypingUserIds = Object.entries(pruneTypingState(typingState))
      .filter(([userId]) => userId !== currentUserId)
      .map(([userId]) => userId);

    return counterpartProfiles.filter((profile) => activeTypingUserIds.includes(profile.id));
  }, [counterpartProfiles, currentProfileQuery.data?.id, typingState]);

  return {
    connectionError,
    connectionState,
    presence,
    typingParticipants,
  };
}

function applyTypingEvent(
  currentState: Record<string, string>,
  event: TypingUpdatedEvent,
): Record<string, string> {
  if (event.state === 'stopped') {
    const nextState = { ...currentState };
    delete nextState[event.userId];
    return nextState;
  }

  return {
    ...currentState,
    [event.userId]: event.expiresAt,
  };
}

function pruneTypingState(currentState: Record<string, string>): Record<string, string> {
  const now = Date.now();

  return Object.fromEntries(
    Object.entries(currentState).filter(([, expiresAt]) => new Date(expiresAt).getTime() > now),
  );
}
