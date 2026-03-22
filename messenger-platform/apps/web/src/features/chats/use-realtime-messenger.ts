"use client";

import {
  messageCreatedEventSchema,
  messageDeliveryStatusEventSchema,
  messageEditedEventSchema,
  messageReactionUpdatedEventSchema,
  realtimeEventNames,
  typingEventSchema,
  type StoredMessage
} from "@messenger/shared";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  fromStoredMessage,
  mergeRealtimeMessage,
  toOptimisticMessage
} from "./application/remote-message-normalizer";
import {
  createConversationE2EEClient,
  decodeLegacyEnvelope
} from "./e2ee-client";
import type { RealtimeMessage } from "./domain/realtime-message";
import { listConversationMessages, sendEncryptedMessage } from "./infrastructure/messages-api";
import { createMessengerSocket, type MessengerSocket } from "./infrastructure/realtime-socket";
import { messages as fallbackMessages } from "./mock-data";

const buildFallbackMessages = (
  conversationId: string,
  currentUserId: string
): RealtimeMessage[] =>
  fallbackMessages.map((message, index) => {
    const createdAt = `2026-03-22T09:1${4 + index}:00.000Z`;

    if (message.role === "outgoing") {
      return {
        ...toOptimisticMessage({
          clientMessageId: `fallback-${message.id}`,
          conversationId,
          senderUserId: currentUserId,
          senderDeviceId: "web-1",
          body: message.body,
          createdAt
        }),
        deliveryStatus: "delivered"
      };
    }

    return {
      id: `fallback-${message.id}`,
      clientMessageId: `fallback-${message.id}`,
      conversationId,
      senderUserId: message.author.toLowerCase(),
      senderDeviceId: `${message.author.toLowerCase()}-desktop`,
      author: message.author,
      role: "incoming",
      body: message.body,
      createdAt,
      timestamp: new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).format(new Date(createdAt)),
      reactions: [...message.reactions],
      reactionDetails: [],
      deliveryStatus: "delivered",
      edited: "edited" in message ? Boolean(message.edited) : false
    };
  });

const resolveMessageBody = async (
  message: StoredMessage,
  currentUserId: string,
  e2eeClient: ReturnType<typeof createConversationE2EEClient>
) => {
  if (message.envelope.version === "legacy-base64") {
    return decodeLegacyEnvelope(message.envelope.ciphertext);
  }

  const cached = await e2eeClient.getCachedPlaintext(message);

  if (cached) {
    return cached;
  }

  return message.senderUserId === currentUserId
    ? "Encrypted message"
    : "Encrypted message";
};

export interface UseRealtimeMessengerOptions {
  conversationId: string;
  currentUserId: string;
  currentDeviceId: string;
  authToken?: string;
  peerUserId?: string;
}

export const useRealtimeMessenger = ({
  conversationId,
  currentUserId,
  currentDeviceId,
  authToken,
  peerUserId
}: UseRealtimeMessengerOptions) => {
  const [connectionState, setConnectionState] = useState<
    "connecting" | "online" | "offline"
  >(authToken ? "connecting" : "offline");
  const [messages, setMessages] = useState<RealtimeMessage[]>(() =>
    buildFallbackMessages(conversationId, currentUserId)
  );
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [typingLabel, setTypingLabel] = useState<string | null>(null);

  const socketRef = useRef<MessengerSocket | null>(null);
  const typingStopTimeoutRef = useRef<number | null>(null);
  const isTypingRef = useRef(false);
  const e2eeClient = useMemo(
    () =>
      createConversationE2EEClient({
        conversationId,
        currentUserId,
        currentDeviceId
      }),
    [conversationId, currentDeviceId, currentUserId]
  );

  useEffect(() => {
    if (!authToken) {
      setMessages(buildFallbackMessages(conversationId, currentUserId));
      setConnectionState("offline");
      return;
    }

    let cancelled = false;

    const bootstrapHistory = async () => {
      try {
        const history = await listConversationMessages({
          conversationId,
          token: authToken,
          deviceId: currentDeviceId
        });

        const nextMessages = await Promise.all(
          history.map(async (message) =>
            fromStoredMessage({
              message,
              currentUserId,
              body: await resolveMessageBody(message, currentUserId, e2eeClient)
            })
          )
        );

        if (!cancelled) {
          setMessages(nextMessages);
        }
      } catch (historyError) {
        if (!cancelled) {
          setError(
            historyError instanceof Error
              ? historyError.message
              : "Failed to load encrypted history."
          );
        }
      }
    };

    void bootstrapHistory();

    return () => {
      cancelled = true;
    };
  }, [authToken, conversationId, currentDeviceId, currentUserId, e2eeClient]);

  useEffect(() => {
    if (!authToken) {
      return;
    }

    const socket = createMessengerSocket(authToken);
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnectionState("online");
      setError(null);
      socket.emit(realtimeEventNames.joinConversation, {
        conversationId,
        userId: currentUserId
      });
    });

    socket.on("disconnect", () => {
      setConnectionState("offline");
    });

    socket.on("connect_error", (socketError) => {
      setConnectionState("offline");
      setError(socketError.message);
    });

    socket.on(realtimeEventNames.messageCreated, async (payload: unknown) => {
      const event = messageCreatedEventSchema.parse(payload);
      const body = await resolveMessageBody(
        event.message,
        currentUserId,
        e2eeClient
      );

      setMessages((current) =>
        mergeRealtimeMessage(
          current,
          fromStoredMessage({
            message: event.message,
            currentUserId,
            body
          })
        )
      );
    });

    socket.on(
      realtimeEventNames.messageDeliveryStatus,
      (payload: unknown) => {
        const event = messageDeliveryStatusEventSchema.parse(payload);

        setMessages((current) =>
          current.map((message) =>
            message.clientMessageId === event.clientMessageId ||
            message.id === event.clientMessageId
              ? {
                  ...message,
                  id: event.messageId,
                  deliveryStatus: event.status
                }
              : message
          )
        );
      }
    );

    socket.on(realtimeEventNames.messageEdited, async (payload: unknown) => {
      const event = messageEditedEventSchema.parse(payload);
      const body = await resolveMessageBody(
        event.message,
        currentUserId,
        e2eeClient
      );

      setMessages((current) =>
        mergeRealtimeMessage(
          current,
          fromStoredMessage({
            message: event.message,
            currentUserId,
            body
          })
        )
      );
    });

    socket.on(
      realtimeEventNames.messageReactionUpdated,
      async (payload: unknown) => {
        const event = messageReactionUpdatedEventSchema.parse(payload);
        const body = await resolveMessageBody(
          event.message,
          currentUserId,
          e2eeClient
        );

        setMessages((current) =>
          mergeRealtimeMessage(
            current,
            fromStoredMessage({
              message: event.message,
              currentUserId,
              body
            })
          )
        );
      }
    );

    socket.on(realtimeEventNames.typingStart, (payload: unknown) => {
      const event = typingEventSchema.parse(payload);

      if (event.userId === currentUserId) {
        return;
      }

      setTypingLabel(`${event.userId} is typing...`);
    });

    socket.on(realtimeEventNames.typingStop, (payload: unknown) => {
      const event = typingEventSchema.parse(payload);

      if (event.userId === currentUserId) {
        return;
      }

      setTypingLabel(null);
    });

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [authToken, conversationId, currentUserId, e2eeClient]);

  useEffect(() => {
    const socket = socketRef.current;

    if (!socket || !authToken) {
      return;
    }

    if (draft.trim().length > 0 && !isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit(realtimeEventNames.typingStart, {
        conversationId,
        userId: currentUserId,
        deviceId: currentDeviceId,
        startedAt: new Date().toISOString()
      });
    }

    if (typingStopTimeoutRef.current) {
      window.clearTimeout(typingStopTimeoutRef.current);
    }

    typingStopTimeoutRef.current = window.setTimeout(() => {
      if (!isTypingRef.current) {
        return;
      }

      socket.emit(realtimeEventNames.typingStop, {
        conversationId,
        userId: currentUserId,
        deviceId: currentDeviceId,
        startedAt: new Date().toISOString()
      });
      isTypingRef.current = false;
    }, 1200);

    return () => {
      if (typingStopTimeoutRef.current) {
        window.clearTimeout(typingStopTimeoutRef.current);
      }
    };
  }, [authToken, conversationId, currentDeviceId, currentUserId, draft]);

  const sendMessage = async () => {
    const trimmed = draft.trim();

    if (trimmed.length === 0 || !authToken) {
      return;
    }

    const now = new Date().toISOString();
    const clientMessageId = crypto.randomUUID();
    const optimisticMessage = toOptimisticMessage({
      clientMessageId,
      conversationId,
      senderUserId: currentUserId,
      senderDeviceId: currentDeviceId,
      body: trimmed,
      createdAt: now
    });
    const envelope = await e2eeClient.encryptText(trimmed, {
      conversationId,
      senderUserId: currentUserId,
      senderDeviceId: currentDeviceId,
      cacheKeys: [clientMessageId]
    });

    setMessages((current) => mergeRealtimeMessage(current, optimisticMessage));
    setDraft("");
    setError(null);

    const payload = {
      clientMessageId,
      conversationId,
      senderUserId: currentUserId,
      senderDeviceId: currentDeviceId,
      recipientUserIds: [peerUserId ?? currentUserId],
      envelope
    };

    const socket = socketRef.current;

    if (socket?.connected) {
      socket.emit(
        realtimeEventNames.messageSend,
        payload,
        async (result: { ok: boolean; data?: StoredMessage; error?: string }) => {
          if (!result.ok) {
            setMessages((current) =>
              current.map((message) =>
                message.clientMessageId === clientMessageId
                  ? {
                      ...message,
                      deliveryStatus: "failed"
                    }
                  : message
              )
            );
            setError(result.error ?? "Failed to send encrypted message.");
            return;
          }

          if (result.data) {
            await e2eeClient.rememberPlaintext(
              [clientMessageId, result.data.id],
              trimmed
            );
          }
        }
      );

      return;
    }

    try {
      const stored = await sendEncryptedMessage({
        ...payload,
        token: authToken
      });
      await e2eeClient.rememberPlaintext([clientMessageId, stored.id], trimmed);
      setMessages((current) =>
        mergeRealtimeMessage(
          current,
          fromStoredMessage({
            message: stored,
            currentUserId,
            body: trimmed
          })
        )
      );
    } catch (sendError) {
      setMessages((current) =>
        current.map((message) =>
          message.clientMessageId === clientMessageId
            ? {
                ...message,
                deliveryStatus: "failed"
              }
            : message
        )
      );
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Failed to send encrypted message."
      );
    }
  };

  const reactToMessage = (messageId: string, emoji: string) => {
    const socket = socketRef.current;

    setMessages((current) =>
      current.map((message) => {
        if (
          message.id !== messageId ||
          message.reactionDetails.some(
            (reaction) =>
              reaction.userId === currentUserId && reaction.emoji === emoji
          )
        ) {
          return message;
        }

        const now = new Date().toISOString();

        return {
          ...message,
          reactions: [...message.reactions, emoji],
          reactionDetails: [
            ...message.reactionDetails,
            {
              userId: currentUserId,
              emoji,
              createdAt: now
            }
          ]
        };
      })
    );

    if (!socket?.connected) {
      return;
    }

    socket.emit(realtimeEventNames.messageReaction, {
      conversationId,
      messageId,
      userId: currentUserId,
      emoji
    });
  };

  const editMessage = async (messageId: string, nextBody: string) => {
    const trimmed = nextBody.trim();
    const socket = socketRef.current;

    if (trimmed.length === 0 || !socket?.connected) {
      return;
    }

    const envelope = await e2eeClient.encryptText(trimmed, {
      conversationId,
      senderUserId: currentUserId,
      senderDeviceId: currentDeviceId,
      cacheKeys: [messageId]
    });

    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? {
              ...message,
              body: trimmed,
              edited: true
            }
          : message
      )
    );

    socket.emit(realtimeEventNames.messageEdit, {
      messageId,
      editorUserId: currentUserId,
      envelope
    });
  };

  return {
    connectionState,
    draft,
    error,
    messages,
    setDraft,
    sendMessage,
    reactToMessage,
    editMessage,
    typingLabel
  };
};
