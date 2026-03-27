import { z } from 'zod';

import {
  conversationIdSchema,
  messageBodySchema,
  messageIdSchema,
  messageKindSchema,
  messageReactionSchema,
  messageReferenceSchema,
  messageStatusSchema,
  reactionValueSchema,
  systemMessageMetadataSchema,
} from './shared';
import { userProfileCardSchema } from '../users/profile';

export const messageSchema = z.object({
  author: userProfileCardSchema.nullable(),
  body: z.string().max(4_000).nullable(),
  conversationId: conversationIdSchema,
  createdAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
  editedAt: z.string().datetime().nullable(),
  id: messageIdSchema,
  kind: messageKindSchema,
  reactions: z.array(messageReactionSchema),
  replyToMessage: messageReferenceSchema.nullable(),
  sequence: z.number().int().positive(),
  status: messageStatusSchema,
  systemMetadata: systemMessageMetadataSchema.nullable(),
  updatedAt: z.string().datetime(),
});

export const paginatedMessagesSchema = z.object({
  messages: z.array(messageSchema),
  nextBeforeSequence: z.number().int().positive().nullable(),
});

export const messageHistoryQuerySchema = z
  .object({
    beforeSequence: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(40),
  })
  .strict();

export const sendMessageSchema = z
  .object({
    body: messageBodySchema,
    clientRequestId: z.string().uuid().optional(),
    replyToMessageId: messageIdSchema.optional(),
  })
  .strict();

export const editMessageSchema = z
  .object({
    body: messageBodySchema,
  })
  .strict();

export const updateReadStateSchema = z
  .object({
    lastReadSequence: z.coerce.number().int().nonnegative(),
  })
  .strict();

export const upsertReactionSchema = z
  .object({
    value: reactionValueSchema,
  })
  .strict();

export const messageRouteParamsSchema = z.object({
  conversationId: conversationIdSchema,
  messageId: messageIdSchema,
});

export const reactionRouteParamsSchema = messageRouteParamsSchema.extend({
  reaction: reactionValueSchema,
});

export const readStateSchema = z.object({
  lastReadAt: z.string().datetime().nullable(),
  lastReadMessageId: messageIdSchema.nullable(),
  lastReadSequence: z.number().int().nonnegative(),
});

export type EditMessageInput = z.infer<typeof editMessageSchema>;
export type Message = z.infer<typeof messageSchema>;
export type MessageHistoryQuery = z.infer<typeof messageHistoryQuerySchema>;
export type MessageRouteParams = z.infer<typeof messageRouteParamsSchema>;
export type PaginatedMessages = z.infer<typeof paginatedMessagesSchema>;
export type ReactionRouteParams = z.infer<typeof reactionRouteParamsSchema>;
export type ReadState = z.infer<typeof readStateSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type UpdateReadStateInput = z.infer<typeof updateReadStateSchema>;
export type UpsertReactionInput = z.infer<typeof upsertReactionSchema>;
