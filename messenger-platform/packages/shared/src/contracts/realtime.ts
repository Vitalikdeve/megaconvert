import { z } from "zod";

import {
  editMessageInputSchema,
  messageDeliveryReceiptSchema,
  reactionInputSchema,
  sendMessageInputSchema,
  storedMessageSchema
} from "./chat";

export const conversationJoinSchema = z.object({
  conversationId: z.string().min(1),
  userId: z.string().min(1)
});

export const typingEventSchema = z.object({
  conversationId: z.string().min(1),
  userId: z.string().min(1),
  deviceId: z.string().min(1),
  startedAt: z.string().datetime()
});

export const callMediaSchema = z.enum(["voice", "video", "screen"]);

export const webrtcSessionDescriptionSchema = z.object({
  type: z.enum(["offer", "answer"]),
  sdp: z.string().min(1)
});

export const webrtcIceCandidateSchema = z.object({
  candidate: z.string().min(1),
  sdpMid: z.string().nullable().optional(),
  sdpMLineIndex: z.number().int().nullable().optional(),
  usernameFragment: z.string().nullable().optional()
});

export const callSignalBaseSchema = z.object({
  callId: z.string().min(1),
  conversationId: z.string().min(1),
  fromUserId: z.string().min(1),
  toUserId: z.string().min(1),
  media: callMediaSchema
});

export const callOfferSchema = callSignalBaseSchema.extend({
  description: webrtcSessionDescriptionSchema.extend({
    type: z.literal("offer")
  })
});

export const callAnswerSchema = callSignalBaseSchema.extend({
  description: webrtcSessionDescriptionSchema.extend({
    type: z.literal("answer")
  })
});

export const callIceCandidateSchema = callSignalBaseSchema.extend({
  candidate: webrtcIceCandidateSchema
});

export const callEndSchema = callSignalBaseSchema.extend({
  reason: z.enum(["hangup", "declined", "failed", "busy", "completed"])
});

export const messageCreatedEventSchema = z.object({
  message: storedMessageSchema
});

export const messageEditedEventSchema = z.object({
  message: storedMessageSchema
});

export const messageReactionUpdatedEventSchema = z.object({
  message: storedMessageSchema
});

export const messageSendCommandSchema = sendMessageInputSchema;
export const messageEditCommandSchema = editMessageInputSchema;
export const messageReactionCommandSchema = reactionInputSchema;
export const messageDeliveryStatusEventSchema = messageDeliveryReceiptSchema;

export type ConversationJoin = z.infer<typeof conversationJoinSchema>;
export type TypingEvent = z.infer<typeof typingEventSchema>;
export type CallMedia = z.infer<typeof callMediaSchema>;
export type WebRtcSessionDescription = z.infer<typeof webrtcSessionDescriptionSchema>;
export type WebRtcIceCandidate = z.infer<typeof webrtcIceCandidateSchema>;
export type CallOffer = z.infer<typeof callOfferSchema>;
export type CallAnswer = z.infer<typeof callAnswerSchema>;
export type CallIceCandidate = z.infer<typeof callIceCandidateSchema>;
export type CallEnd = z.infer<typeof callEndSchema>;
export type MessageCreatedEvent = z.infer<typeof messageCreatedEventSchema>;
export type MessageEditedEvent = z.infer<typeof messageEditedEventSchema>;
export type MessageReactionUpdatedEvent = z.infer<typeof messageReactionUpdatedEventSchema>;
export type MessageSendCommand = z.infer<typeof messageSendCommandSchema>;
export type MessageEditCommand = z.infer<typeof messageEditCommandSchema>;
export type MessageReactionCommand = z.infer<typeof messageReactionCommandSchema>;
export type MessageDeliveryStatusEvent = z.infer<typeof messageDeliveryStatusEventSchema>;

export const realtimeEventNames = {
  joinConversation: "conversation:join",
  messageSend: "message:send",
  messageCreated: "message:created",
  messageEdit: "message:edit",
  messageEdited: "message:edited",
  messageReaction: "message:reaction",
  messageReactionUpdated: "message:reaction-updated",
  messageDeliveryStatus: "message:delivery-status",
  typingStart: "typing:start",
  typingStop: "typing:stop",
  callOffer: "call:offer",
  callAnswer: "call:answer",
  callIceCandidate: "call:ice-candidate",
  callEnd: "call:end"
} as const;
