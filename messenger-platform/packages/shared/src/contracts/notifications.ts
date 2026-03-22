import { z } from "zod";

export const webPushKeysSchema = z.object({
  p256dh: z.string().min(1),
  auth: z.string().min(1)
});

export const webPushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  expirationTime: z.number().nullable().optional(),
  keys: webPushKeysSchema
});

export const registerPushSubscriptionSchema = z.object({
  subscription: webPushSubscriptionSchema,
  userAgent: z.string().max(512).optional()
});

export const removePushSubscriptionSchema = z.object({
  endpoint: z.string().url()
});

export const pushNotificationPayloadSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  tag: z.string().min(1).optional(),
  data: z.record(z.string(), z.string()).optional()
});

export type WebPushSubscription = z.infer<typeof webPushSubscriptionSchema>;
export type RegisterPushSubscriptionInput = z.infer<
  typeof registerPushSubscriptionSchema
>;
export type RemovePushSubscriptionInput = z.infer<
  typeof removePushSubscriptionSchema
>;
export type PushNotificationPayload = z.infer<
  typeof pushNotificationPayloadSchema
>;
