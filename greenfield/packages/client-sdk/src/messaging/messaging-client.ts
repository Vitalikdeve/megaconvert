import {
  conversationDetailSchema,
  conversationDraftSchema,
  conversationListQuerySchema,
  createDirectConversationSchema,
  createGroupConversationSchema,
  createResponseEnvelopeSchema,
  editMessageSchema,
  messageHistoryQuerySchema,
  messageSchema,
  paginatedConversationsSchema,
  paginatedMessagesSchema,
  readStateSchema,
  reactionValueSchema,
  sendMessageSchema,
  updateConversationDraftSchema,
  updateReadStateSchema,
  type ConversationDetail,
  type ConversationDraft,
  type ConversationListQuery,
  type CreateDirectConversationInput,
  type CreateGroupConversationInput,
  type EditMessageInput,
  type Message,
  type MessageHistoryQuery,
  type PaginatedConversations,
  type PaginatedMessages,
  type ReadState,
  type SendMessageInput,
  type UpdateConversationDraftInput,
  type UpdateReadStateInput,
} from '@megaconvert/contracts';
import { z } from 'zod';

import { createJsonClient, type JsonClient } from '../http/json-client';

const conversationDetailEnvelopeSchema = createResponseEnvelopeSchema(conversationDetailSchema);
const paginatedConversationsEnvelopeSchema = createResponseEnvelopeSchema(paginatedConversationsSchema);
const paginatedMessagesEnvelopeSchema = createResponseEnvelopeSchema(paginatedMessagesSchema);
const messageEnvelopeSchema = createResponseEnvelopeSchema(messageSchema);
const readStateEnvelopeSchema = createResponseEnvelopeSchema(readStateSchema);
const conversationDraftEnvelopeSchema = createResponseEnvelopeSchema(
  z.object({
    draft: conversationDraftSchema.nullable(),
  }),
);

export interface MessagingClientOptions {
  baseUrl: string;
  client?: JsonClient;
}

export interface MessagingClient {
  createDirectConversation(input: CreateDirectConversationInput): Promise<ConversationDetail>;
  createGroupConversation(input: CreateGroupConversationInput): Promise<ConversationDetail>;
  deleteMessage(conversationId: string, messageId: string): Promise<Message>;
  editMessage(
    conversationId: string,
    messageId: string,
    input: EditMessageInput,
  ): Promise<Message>;
  getConversationDetail(conversationId: string): Promise<ConversationDetail>;
  listConversationMessages(
    conversationId: string,
    query?: Partial<MessageHistoryQuery>,
  ): Promise<PaginatedMessages>;
  listConversations(query?: Partial<ConversationListQuery>): Promise<PaginatedConversations>;
  removeReaction(conversationId: string, messageId: string, reaction: string): Promise<Message>;
  saveDraft(
    conversationId: string,
    input: UpdateConversationDraftInput,
  ): Promise<ConversationDraft | null>;
  sendMessage(conversationId: string, input: SendMessageInput): Promise<Message>;
  updateReadState(conversationId: string, input: UpdateReadStateInput): Promise<ReadState>;
  upsertReaction(conversationId: string, messageId: string, reaction: string): Promise<Message>;
}

export function createMessagingClient(options: MessagingClientOptions): MessagingClient {
  const client =
    options.client ??
    createJsonClient({
      baseUrl: options.baseUrl,
      timeoutMs: 10_000,
    });

  return {
    async createDirectConversation(input) {
      const payload = await client.post('/messaging/conversations/direct', {
        body: createDirectConversationSchema.parse(input),
        credentials: 'include',
        schema: conversationDetailEnvelopeSchema,
      });

      return payload.data;
    },
    async createGroupConversation(input) {
      const payload = await client.post('/messaging/conversations/group', {
        body: createGroupConversationSchema.parse(input),
        credentials: 'include',
        schema: conversationDetailEnvelopeSchema,
      });

      return payload.data;
    },
    async deleteMessage(conversationId, messageId) {
      const payload = await client.delete(
        `/messaging/conversations/${conversationId}/messages/${messageId}`,
        {
          credentials: 'include',
          schema: messageEnvelopeSchema,
        },
      );

      return payload.data;
    },
    async editMessage(conversationId, messageId, input) {
      const payload = await client.patch(
        `/messaging/conversations/${conversationId}/messages/${messageId}`,
        {
          body: editMessageSchema.parse(input),
          credentials: 'include',
          schema: messageEnvelopeSchema,
        },
      );

      return payload.data;
    },
    async getConversationDetail(conversationId) {
      const payload = await client.get(`/messaging/conversations/${conversationId}`, {
        credentials: 'include',
        schema: conversationDetailEnvelopeSchema,
      });

      return payload.data;
    },
    async listConversationMessages(conversationId, query) {
      const payload = await client.get(`/messaging/conversations/${conversationId}/messages`, {
        credentials: 'include',
        query: messageHistoryQuerySchema.partial().parse(query ?? {}),
        schema: paginatedMessagesEnvelopeSchema,
      });

      return payload.data;
    },
    async listConversations(query) {
      const payload = await client.get('/messaging/conversations', {
        credentials: 'include',
        query: conversationListQuerySchema.partial().parse(query ?? {}),
        schema: paginatedConversationsEnvelopeSchema,
      });

      return payload.data;
    },
    async removeReaction(conversationId, messageId, reaction) {
      const payload = await client.delete(
        `/messaging/conversations/${conversationId}/messages/${messageId}/reactions/${encodeURIComponent(reactionValueSchema.parse(reaction))}`,
        {
          credentials: 'include',
          schema: messageEnvelopeSchema,
        },
      );

      return payload.data;
    },
    async saveDraft(conversationId, input) {
      const payload = await client.put(`/messaging/conversations/${conversationId}/draft`, {
        body: updateConversationDraftSchema.parse(input),
        credentials: 'include',
        schema: conversationDraftEnvelopeSchema,
      });

      return payload.data.draft;
    },
    async sendMessage(conversationId, input) {
      const payload = await client.post(`/messaging/conversations/${conversationId}/messages`, {
        body: sendMessageSchema.parse(input),
        credentials: 'include',
        schema: messageEnvelopeSchema,
      });

      return payload.data;
    },
    async updateReadState(conversationId, input) {
      const payload = await client.put(`/messaging/conversations/${conversationId}/read-state`, {
        body: updateReadStateSchema.parse(input),
        credentials: 'include',
        schema: readStateEnvelopeSchema,
      });

      return payload.data;
    },
    async upsertReaction(conversationId, messageId, reaction) {
      const payload = await client.put(
        `/messaging/conversations/${conversationId}/messages/${messageId}/reactions/${encodeURIComponent(reactionValueSchema.parse(reaction))}`,
        {
          credentials: 'include',
          schema: messageEnvelopeSchema,
        },
      );

      return payload.data;
    },
  };
}
