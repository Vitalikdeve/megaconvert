import { z } from 'zod';

import { userProfileCardSchema } from '../users/profile';

export const conversationIdSchema = z.string().uuid();
export const messageIdSchema = z.string().uuid();
export const membershipRoleSchema = z.enum(['admin', 'member', 'owner']);
export const conversationKindSchema = z.enum(['direct', 'group']);
export const messageKindSchema = z.enum(['system', 'user']);
export const messageStatusSchema = z.enum(['active', 'deleted', 'edited']);
export const systemMessageEventTypeSchema = z.enum([
  'conversation_created',
  'member_added',
  'member_removed',
  'title_updated',
]);

export const reactionValueSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), {
    message: 'Reaction contains unsupported control characters.',
  });

export const messageBodySchema = z
  .string()
  .trim()
  .min(1)
  .max(4_000)
  .refine((value) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value), {
    message: 'Message contains unsupported control characters.',
  });

export const draftBodySchema = z
  .string()
  .trim()
  .max(4_000)
  .refine((value) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value), {
    message: 'Draft contains unsupported control characters.',
  });

export const conversationTitleSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), {
    message: 'Conversation title contains unsupported control characters.',
  });

export const conversationDraftSchema = z.object({
  body: draftBodySchema,
  replyToMessageId: messageIdSchema.nullable(),
  updatedAt: z.string().datetime(),
});

export const messageReactionSchema = z.object({
  count: z.number().int().nonnegative(),
  participantIds: z.array(z.string().uuid()).max(16),
  reactedByViewer: z.boolean(),
  value: reactionValueSchema,
});

export const systemMessageMetadataSchema = z.object({
  affectedUserIds: z.array(z.string().uuid()).default([]),
  eventType: systemMessageEventTypeSchema,
  title: z.string().min(1).nullable().default(null),
});

export const messageReferenceSchema = z.object({
  author: userProfileCardSchema.nullable(),
  bodyPreview: z.string().min(1).max(280).nullable(),
  createdAt: z.string().datetime(),
  id: messageIdSchema,
  kind: messageKindSchema,
  sequence: z.number().int().positive(),
  status: messageStatusSchema,
});

export const conversationViewerStateSchema = z.object({
  joinedAt: z.string().datetime(),
  lastReadAt: z.string().datetime().nullable(),
  lastReadMessageId: messageIdSchema.nullable(),
  lastReadSequence: z.number().int().nonnegative(),
  role: membershipRoleSchema,
  unreadCount: z.number().int().nonnegative(),
});

export const conversationMemberSchema = z.object({
  joinedAt: z.string().datetime(),
  role: membershipRoleSchema,
  user: userProfileCardSchema,
});

export const conversationLastMessageSchema = z.object({
  author: userProfileCardSchema.nullable(),
  bodyPreview: z.string().min(1).max(280).nullable(),
  createdAt: z.string().datetime(),
  id: messageIdSchema,
  kind: messageKindSchema,
  sequence: z.number().int().positive(),
  status: messageStatusSchema,
});

export type ConversationDraft = z.infer<typeof conversationDraftSchema>;
export type ConversationKind = z.infer<typeof conversationKindSchema>;
export type ConversationLastMessage = z.infer<typeof conversationLastMessageSchema>;
export type ConversationMember = z.infer<typeof conversationMemberSchema>;
export type ConversationViewerState = z.infer<typeof conversationViewerStateSchema>;
export type MembershipRole = z.infer<typeof membershipRoleSchema>;
export type MessageReaction = z.infer<typeof messageReactionSchema>;
export type MessageReference = z.infer<typeof messageReferenceSchema>;
export type MessageStatus = z.infer<typeof messageStatusSchema>;
export type MessageKind = z.infer<typeof messageKindSchema>;
export type SystemMessageMetadata = z.infer<typeof systemMessageMetadataSchema>;
