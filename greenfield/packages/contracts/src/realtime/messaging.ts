import { z } from 'zod';

import { conversationDetailSchema, conversationSummarySchema } from '../messaging/conversations';
import { messageSchema, readStateSchema } from '../messaging/messages';
import { conversationIdSchema } from '../messaging/shared';

export const messagingSocketSubscriptionSchema = z.object({
  conversationId: conversationIdSchema,
});

export const messagingTypingEventSchema = z.object({
  conversationId: conversationIdSchema,
});

export const messagingSocketAckSchema = z.object({
  code: z.string().min(1).nullable(),
  conversationId: conversationIdSchema.nullable(),
  ok: z.boolean(),
});

export const conversationPresenceEventSchema = z.object({
  activeCount: z.number().int().nonnegative(),
  activeUserIds: z.array(z.string().uuid()).max(64),
  conversationId: conversationIdSchema,
  type: z.literal('messaging.conversation.presence.updated'),
});

export const conversationSummaryUpdatedEventSchema = z.object({
  conversation: conversationSummarySchema,
  type: z.literal('messaging.conversation.summary.updated'),
});

export const inboxChangedEventSchema = z.object({
  conversationId: conversationIdSchema,
  reason: z.enum([
    'conversation_created',
    'draft_updated',
    'message_deleted',
    'message_sent',
    'message_updated',
    'read_state_updated',
    'reaction_updated',
  ]),
  type: z.literal('messaging.inbox.changed'),
});

export const conversationHydratedEventSchema = z.object({
  conversation: conversationDetailSchema,
  readState: readStateSchema,
  type: z.literal('messaging.conversation.hydrated'),
});

export const messageCreatedEventSchema = z.object({
  conversationId: conversationIdSchema,
  message: messageSchema,
  type: z.literal('messaging.message.created'),
});

export const messageUpdatedEventSchema = z.object({
  conversationId: conversationIdSchema,
  message: messageSchema,
  type: z.literal('messaging.message.updated'),
});

export const messageDeletedEventSchema = z.object({
  conversationId: conversationIdSchema,
  message: messageSchema,
  type: z.literal('messaging.message.deleted'),
});

export const readStateUpdatedEventSchema = z.object({
  conversationId: conversationIdSchema,
  readState: readStateSchema.extend({
    userId: z.string().uuid(),
  }),
  type: z.literal('messaging.read-state.updated'),
});

export const typingUpdatedEventSchema = z.object({
  conversationId: conversationIdSchema,
  expiresAt: z.string().datetime(),
  state: z.enum(['started', 'stopped']),
  type: z.literal('messaging.typing.updated'),
  userId: z.string().uuid(),
});

export const messagingServerEventSchema = z.discriminatedUnion('type', [
  conversationHydratedEventSchema,
  conversationPresenceEventSchema,
  conversationSummaryUpdatedEventSchema,
  inboxChangedEventSchema,
  messageCreatedEventSchema,
  messageDeletedEventSchema,
  messageUpdatedEventSchema,
  readStateUpdatedEventSchema,
  typingUpdatedEventSchema,
]);

export const messagingTransportEnvelopeSchema = z.object({
  event: messagingServerEventSchema,
  excludeSocketId: z.string().min(1).nullable().default(null),
  targetRooms: z.array(z.string().min(1)).min(1),
});

export type ConversationHydratedEvent = z.infer<typeof conversationHydratedEventSchema>;
export type ConversationPresenceEvent = z.infer<typeof conversationPresenceEventSchema>;
export type ConversationSummaryUpdatedEvent = z.infer<typeof conversationSummaryUpdatedEventSchema>;
export type InboxChangedEvent = z.infer<typeof inboxChangedEventSchema>;
export type MessageCreatedEvent = z.infer<typeof messageCreatedEventSchema>;
export type MessageDeletedEvent = z.infer<typeof messageDeletedEventSchema>;
export type MessageUpdatedEvent = z.infer<typeof messageUpdatedEventSchema>;
export type MessagingServerEvent = z.infer<typeof messagingServerEventSchema>;
export type MessagingSocketAck = z.infer<typeof messagingSocketAckSchema>;
export type MessagingSocketSubscription = z.infer<typeof messagingSocketSubscriptionSchema>;
export type MessagingTransportEnvelope = z.infer<typeof messagingTransportEnvelopeSchema>;
export type MessagingTypingEvent = z.infer<typeof messagingTypingEventSchema>;
export type ReadStateUpdatedEvent = z.infer<typeof readStateUpdatedEventSchema>;
export type TypingUpdatedEvent = z.infer<typeof typingUpdatedEventSchema>;
