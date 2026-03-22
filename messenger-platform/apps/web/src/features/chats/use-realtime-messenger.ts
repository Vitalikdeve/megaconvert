"use client";

import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

import type { RealtimeMessage } from "./domain/realtime-message";
import {
  mergeRealtimeMessage,
  normalizeRemoteMessage,
  toOptimisticMessage
} from "./application/remote-message-normalizer";
import type { RemoteSocketMessagePayload } from "./domain/remote-chat.types";
import {
  createMessengerSocket,
  emitRemoteMessage
} from "./infrastructure/realtime-socket";
import { sendRemoteMessage } from "./infrastructure/messages-api";
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

export interface UseRealtimeMessengerOptions {
  conversationId: string;
  currentUserId: string;
  currentDeviceId: string;
  authToken?: string;
}

export const useRealtimeMessenger = ({
  conversationId,
  currentUserId,
  currentDeviceId,
  authToken
}: UseRealtimeMessengerOptions) => {
  const [connectionState, setConnectionState] = useState<
    "connecting" | "online" | "offline"
  >("connecting");
  const [messages, setMessages] = useState<RealtimeMessage[]>(() =>
    buildFallbackMessages(conversationId, currentUserId)
  );
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    setMessages(buildFallbackMessages(conversationId, currentUserId));
  }, [conversationId, currentUserId]);

  useEffect(() => {
    const socket = createMessengerSocket();
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnectionState("online");
      setError(null);
    });

    socket.on("disconnect", () => {
      setConnectionState("offline");
    });

    socket.on("connect_error", (socketError) => {
      setConnectionState("offline");
      setError(socketError.message);
    });

    socket.on("receive_message", (payload: unknown) => {
      const normalized = normalizeRemoteMessage({
        payload,
        currentUserId,
        fallbackChatId: conversationId
      });

      if (!normalized || normalized.conversationId !== conversationId) {
        return;
      }

      setMessages((current) => mergeRealtimeMessage(current, normalized));
    });

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [conversationId, currentUserId]);

  const sendMessage = async () => {
    const trimmed = draft.trim();

    if (trimmed.length === 0) {
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

    setMessages((current) => mergeRealtimeMessage(current, optimisticMessage));
    setDraft("");
    setError(null);

    const socketPayload: RemoteSocketMessagePayload = {
      chatId: conversationId,
      text: trimmed,
      username: currentUserId,
      clientMessageId,
      createdAt: now
    };

    if (socketRef.current) {
      emitRemoteMessage(socketRef.current, socketPayload);
    }

    try {
      const response = await sendRemoteMessage({
        chatId: conversationId,
        text: trimmed,
        token: authToken
      });
      const normalized =
        normalizeRemoteMessage({
          payload: response,
          currentUserId,
          fallbackChatId: conversationId
        }) ??
        normalizeRemoteMessage({
          payload: socketPayload,
          currentUserId,
          fallbackChatId: conversationId
        });

      if (normalized) {
        setMessages((current) =>
          mergeRealtimeMessage(current, {
            ...normalized,
            clientMessageId,
            deliveryStatus: "sent"
          })
        );
      }
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
          : "Failed to send message."
      );
    }
  };

  const reactToMessage = (messageId: string, emoji: string) => {
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
  };

  const editMessage = async (messageId: string, nextBody: string) => {
    const trimmed = nextBody.trim();

    if (trimmed.length === 0) {
      return;
    }

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
    typingLabel: null
  };
};
