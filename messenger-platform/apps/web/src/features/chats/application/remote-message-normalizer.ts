import type { StoredMessage } from "@messenger/shared";

import type { RealtimeMessage } from "../domain/realtime-message";

const formatTimestamp = (iso: string) =>
  new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(iso));

const toIsoDate = (value: unknown) => {
  if (typeof value === "string" && value.length > 0) {
    const parsed = new Date(value);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  if (typeof value === "number") {
    const parsed = new Date(value);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
};

const readString = (
  source: Record<string, unknown>,
  keys: string[]
): string | undefined => {
  for (const key of keys) {
    const value = source[key];

    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return undefined;
};

export const toOptimisticMessage = ({
  clientMessageId,
  conversationId,
  senderUserId,
  senderDeviceId,
  body,
  createdAt
}: {
  clientMessageId: string;
  conversationId: string;
  senderUserId: string;
  senderDeviceId: string;
  body: string;
  createdAt: string;
}): RealtimeMessage => ({
  id: clientMessageId,
  clientMessageId,
  conversationId,
  senderUserId,
  senderDeviceId,
  author: senderUserId,
  role: "outgoing",
  body,
  createdAt,
  timestamp: formatTimestamp(createdAt),
  reactions: [],
  reactionDetails: [],
  deliveryStatus: "sending",
  edited: false
});

export const normalizeRemoteMessage = ({
  payload,
  currentUserId,
  fallbackChatId
}: {
  payload: unknown;
  currentUserId: string;
  fallbackChatId: string;
}): RealtimeMessage | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const body = readString(record, ["text", "message", "body"]);

  if (!body) {
    return null;
  }

  const senderUserId =
    readString(record, ["username", "sender", "senderUserId", "userId"]) ??
    "remote-user";
  const createdAt = toIsoDate(record.createdAt ?? record.timestamp);
  const conversationId =
    readString(record, ["chatId", "conversationId", "roomId"]) ?? fallbackChatId;
  const clientMessageId = readString(record, ["clientMessageId"]);
  const messageId =
    readString(record, ["id", "messageId"]) ??
    clientMessageId ??
    `${senderUserId}-${createdAt}`;

  return {
    id: messageId,
    clientMessageId,
    conversationId,
    senderUserId,
    senderDeviceId: "remote-socket",
    author: senderUserId,
    role: senderUserId === currentUserId ? "outgoing" : "incoming",
    body,
    createdAt,
    timestamp: formatTimestamp(createdAt),
    reactions: [],
    reactionDetails: [],
    deliveryStatus: "delivered",
    edited: false
  };
};

export const mergeRealtimeMessage = (
  current: RealtimeMessage[],
  nextMessage: RealtimeMessage
) => {
  const nextIndex = current.findIndex((message) => {
    if (message.id === nextMessage.id) {
      return true;
    }

    if (
      message.clientMessageId &&
      nextMessage.clientMessageId &&
      message.clientMessageId === nextMessage.clientMessageId
    ) {
      return true;
    }

    return (
      message.deliveryStatus === "sending" &&
      message.senderUserId === nextMessage.senderUserId &&
      message.body === nextMessage.body &&
      Math.abs(
        new Date(message.createdAt).getTime() -
          new Date(nextMessage.createdAt).getTime()
      ) < 15000
    );
  });

  if (nextIndex === -1) {
    return [...current, nextMessage].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt)
    );
  }

  const merged = [...current];
  merged[nextIndex] = {
    ...merged[nextIndex],
    ...nextMessage
  };

  return merged.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
};

export const fromStoredMessage = (options: {
  message: StoredMessage;
  currentUserId: string;
  body: string;
}): RealtimeMessage => ({
  id: options.message.id,
  clientMessageId: options.message.clientMessageId,
  conversationId: options.message.conversationId,
  senderUserId: options.message.senderUserId,
  senderDeviceId: options.message.senderDeviceId,
  author: options.message.senderUserId,
  role:
    options.message.senderUserId === options.currentUserId
      ? "outgoing"
      : "incoming",
  body: options.body,
  createdAt: options.message.createdAt,
  timestamp: formatTimestamp(options.message.createdAt),
  reactions: options.message.reactions.map((reaction) => reaction.emoji),
  reactionDetails: options.message.reactions,
  deliveryStatus: options.message.deliveryStatus,
  edited: Boolean(options.message.editedAt)
});
