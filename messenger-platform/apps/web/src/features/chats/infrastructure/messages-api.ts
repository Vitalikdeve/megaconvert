"use client";

import type {
  EditMessageInput,
  ReactionInput,
  SendMessageInput,
  StoredMessage
} from "@messenger/shared";

import { API_URL } from "@/config/api";
import { requestJson } from "@/shared/infrastructure/http-client";

const authHeaders = (token: string, deviceId: string) => ({
  Authorization: `Bearer ${token}`,
  "x-device-id": deviceId
});

export const listConversationMessages = async (options: {
  conversationId: string;
  token: string;
  deviceId: string;
}) => {
  const response = await requestJson<{
    data: StoredMessage[];
  }>({
    url: `${API_URL}/v1/conversations/${encodeURIComponent(
      options.conversationId
    )}/messages`,
    headers: authHeaders(options.token, options.deviceId)
  });

  return response.data;
};

export const sendEncryptedMessage = async (
  input: SendMessageInput & {
    token: string;
  }
) => {
  const response = await requestJson<{
    data: StoredMessage;
  }>({
    url: `${API_URL}/v1/messages`,
    method: "POST",
    headers: authHeaders(input.token, input.senderDeviceId),
    body: {
      clientMessageId: input.clientMessageId,
      conversationId: input.conversationId,
      senderUserId: input.senderUserId,
      senderDeviceId: input.senderDeviceId,
      recipientUserIds: input.recipientUserIds,
      envelope: input.envelope
    }
  });

  return response.data;
};

export const editEncryptedMessage = async (
  input: EditMessageInput & {
    senderDeviceId: string;
    token: string;
  }
) => {
  const response = await requestJson<{
    data: StoredMessage;
  }>({
    url: `${API_URL}/v1/messages/${encodeURIComponent(input.messageId)}`,
    method: "PATCH",
    headers: authHeaders(input.token, input.senderDeviceId),
    body: {
      editorUserId: input.editorUserId,
      envelope: input.envelope
    }
  });

  return response.data;
};

export const reactToEncryptedMessage = async (
  input: ReactionInput & {
    senderDeviceId: string;
    token: string;
  }
) => {
  const response = await requestJson<{
    data: StoredMessage;
  }>({
    url: `${API_URL}/v1/messages/${encodeURIComponent(input.messageId)}/reactions`,
    method: "POST",
    headers: authHeaders(input.token, input.senderDeviceId),
    body: {
      conversationId: input.conversationId,
      userId: input.userId,
      emoji: input.emoji
    }
  });

  return response.data;
};
