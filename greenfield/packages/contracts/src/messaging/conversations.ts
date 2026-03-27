import { z } from 'zod';

import {
  conversationDraftSchema,
  conversationIdSchema,
  conversationKindSchema,
  conversationLastMessageSchema,
  conversationMemberSchema,
  conversationTitleSchema,
  conversationViewerStateSchema,
  messageReferenceSchema,
} from './shared';
import { userProfileCardSchema } from '../users/profile';
import { usernameSchema } from '../users/shared';

export const createDirectConversationSchema = z
  .object({
    participantUsername: usernameSchema,
  })
  .strict();

export const createGroupConversationSchema = z
  .object({
    memberUsernames: z.array(usernameSchema).min(1).max(63),
    title: conversationTitleSchema,
  })
  .strict();

export const updateConversationDraftSchema = z
  .object({
    body: z.string().trim().max(4_000).nullable(),
    replyToMessageId: z.string().uuid().nullable().optional(),
  })
  .strict();

export const conversationListQuerySchema = z
  .object({
    cursor: z.string().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export const conversationRouteParamsSchema = z.object({
  conversationId: conversationIdSchema,
});

export const conversationSummarySchema = z.object({
  counterpartProfiles: z.array(userProfileCardSchema).max(4),
  createdAt: z.string().datetime(),
  draft: conversationDraftSchema.nullable(),
  id: conversationIdSchema,
  kind: conversationKindSchema,
  lastActivityAt: z.string().datetime(),
  lastMessage: conversationLastMessageSchema.nullable(),
  memberCount: z.number().int().positive(),
  pinnedMessageCount: z.number().int().nonnegative(),
  title: z.string().min(1).nullable(),
  viewer: conversationViewerStateSchema,
});

export const pinnedMessageSchema = z.object({
  message: messageReferenceSchema,
  pinnedAt: z.string().datetime(),
  pinnedBy: userProfileCardSchema,
});

export const conversationDetailSchema = conversationSummarySchema.extend({
  members: z.array(conversationMemberSchema).min(1),
  pinnedMessages: z.array(pinnedMessageSchema),
});

export const paginatedConversationsSchema = z.object({
  conversations: z.array(conversationSummarySchema),
  nextCursor: z.string().min(1).nullable(),
});

export type ConversationDetail = z.infer<typeof conversationDetailSchema>;
export type ConversationListQuery = z.infer<typeof conversationListQuerySchema>;
export type ConversationRouteParams = z.infer<typeof conversationRouteParamsSchema>;
export type ConversationSummary = z.infer<typeof conversationSummarySchema>;
export type CreateDirectConversationInput = z.infer<typeof createDirectConversationSchema>;
export type CreateGroupConversationInput = z.infer<typeof createGroupConversationSchema>;
export type PaginatedConversations = z.infer<typeof paginatedConversationsSchema>;
export type PinnedMessage = z.infer<typeof pinnedMessageSchema>;
export type UpdateConversationDraftInput = z.infer<typeof updateConversationDraftSchema>;
