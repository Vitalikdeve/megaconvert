import { z } from "zod";

export const conversationKindSchema = z.enum(["private", "group"]);

export const messageDeliveryStatusSchema = z.enum([
  "sending",
  "sent",
  "delivered",
  "failed"
]);

export const messageEnvelopeSchema = z.object({
  version: z.enum(["legacy-base64", "signal-inspired-v1"]).default("legacy-base64"),
  algorithm: z.string().min(1).optional(),
  ciphertext: z.string().min(1),
  signature: z.string().min(1),
  sessionId: z.string().min(1),
  ratchetCounter: z.number().int().nonnegative(),
  iv: z.string().min(1).optional(),
  nonce: z.string().min(1).optional(),
  senderRatchetPublicKey: z.string().min(1).optional(),
  previousChainLength: z.number().int().nonnegative().optional(),
  contentType: z.enum(["text", "file"]).optional()
});

export const sendMessageInputSchema = z.object({
  clientMessageId: z.string().min(1),
  conversationId: z.string().min(1),
  senderUserId: z.string().min(1),
  senderDeviceId: z.string().min(1),
  recipientUserIds: z.array(z.string().min(1)).max(64).optional(),
  envelope: messageEnvelopeSchema
});

export const editMessageInputSchema = z.object({
  messageId: z.string().min(1),
  editorUserId: z.string().min(1),
  envelope: messageEnvelopeSchema
});

export const reactionInputSchema = z.object({
  conversationId: z.string().min(1),
  messageId: z.string().min(1),
  userId: z.string().min(1),
  emoji: z.string().min(1).max(8)
});

export const storedReactionSchema = z.object({
  userId: z.string().min(1),
  emoji: z.string().min(1).max(8),
  createdAt: z.string().datetime()
});

export const storedMessageSchema = z.object({
  id: z.string().min(1),
  clientMessageId: z.string().min(1).optional(),
  conversationId: z.string().min(1),
  senderUserId: z.string().min(1),
  senderDeviceId: z.string().min(1),
  envelope: messageEnvelopeSchema,
  createdAt: z.string().datetime(),
  editedAt: z.string().datetime().optional(),
  reactions: z.array(storedReactionSchema),
  deliveryStatus: messageDeliveryStatusSchema,
  deliveryStatusUpdatedAt: z.string().datetime()
});

export const messageDeliveryReceiptSchema = z.object({
  conversationId: z.string().min(1),
  clientMessageId: z.string().min(1),
  messageId: z.string().min(1),
  status: messageDeliveryStatusSchema,
  occurredAt: z.string().datetime()
});

export type MessageEnvelope = z.infer<typeof messageEnvelopeSchema>;
export type MessageDeliveryStatus = z.infer<typeof messageDeliveryStatusSchema>;
export type SendMessageInput = z.infer<typeof sendMessageInputSchema>;
export type EditMessageInput = z.infer<typeof editMessageInputSchema>;
export type ReactionInput = z.infer<typeof reactionInputSchema>;
export type StoredReaction = z.infer<typeof storedReactionSchema>;
export type StoredMessage = z.infer<typeof storedMessageSchema>;
export type MessageDeliveryReceipt = z.infer<typeof messageDeliveryReceiptSchema>;
