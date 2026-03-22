import { z } from "zod";

export const oneTimePreKeySchema = z.object({
  keyId: z.string().min(1),
  publicKey: z.string().min(1)
});

export const registerDeviceBundleSchema = z.object({
  deviceId: z.string().min(1),
  label: z.string().trim().min(1).max(80).default("Primary device"),
  registrationId: z.string().min(1),
  identitySigningPublicKey: z.string().min(1),
  identityDhPublicKey: z.string().min(1),
  signedPreKeyId: z.string().min(1),
  signedPreKeyPublicKey: z.string().min(1),
  signedPreKeySignature: z.string().min(1),
  oneTimePreKeys: z.array(oneTimePreKeySchema).min(1).max(100)
});

export const deviceBundleSchema = registerDeviceBundleSchema.extend({
  oneTimePreKeys: z.array(oneTimePreKeySchema).max(100),
  userId: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const deviceBundleQuerySchema = z.object({
  deviceId: z.string().min(1).optional()
});

export type OneTimePreKey = z.infer<typeof oneTimePreKeySchema>;
export type RegisterDeviceBundleInput = z.infer<typeof registerDeviceBundleSchema>;
export type DeviceBundle = z.infer<typeof deviceBundleSchema>;
export type DeviceBundleQuery = z.infer<typeof deviceBundleQuerySchema>;
