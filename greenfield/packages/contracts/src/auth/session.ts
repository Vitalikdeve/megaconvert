import { z } from 'zod';

import {
  authDeviceKindSchema,
  authenticationMethodSchema,
  authSessionStatusSchema,
} from './method';
import { authenticatedUserSchema } from './user';

export const authSessionDeviceSchema = z.object({
  browser: z.string().min(1).nullable(),
  deviceKind: authDeviceKindSchema,
  deviceLabel: z.string().min(1).nullable(),
  operatingSystem: z.string().min(1).nullable(),
});

export const authSessionSchema = z.object({
  authenticationMethod: authenticationMethodSchema,
  createdAt: z.string().datetime(),
  device: authSessionDeviceSchema,
  expiresAt: z.string().datetime(),
  id: z.string().uuid(),
  ipAddress: z.string().min(1).nullable(),
  isCurrent: z.boolean(),
  lastSeenAt: z.string().datetime(),
  revokedAt: z.string().datetime().nullable(),
  revokedReason: z.string().min(1).nullable(),
  status: authSessionStatusSchema,
  userAgent: z.string().min(1).nullable(),
});

export const currentSessionResponseSchema = z.object({
  availableSignInMethods: z.array(authenticationMethodSchema),
  session: authSessionSchema,
  user: authenticatedUserSchema,
});

export const refreshSessionResponseSchema = z.object({
  accessToken: z.string().min(1),
  accessTokenExpiresAt: z.string().datetime(),
  availableSignInMethods: z.array(authenticationMethodSchema),
  session: authSessionSchema,
  user: authenticatedUserSchema,
});

export const sessionListResponseSchema = z.object({
  currentSessionId: z.string().uuid(),
  sessions: z.array(authSessionSchema),
  user: authenticatedUserSchema,
});

export const logoutResponseSchema = z.object({
  loggedOutSessionCount: z.number().int().nonnegative(),
});

export type AuthSession = z.infer<typeof authSessionSchema>;
export type CurrentSessionResponse = z.infer<typeof currentSessionResponseSchema>;
export type RefreshSessionResponse = z.infer<typeof refreshSessionResponseSchema>;
export type SessionListResponse = z.infer<typeof sessionListResponseSchema>;
export type LogoutResponse = z.infer<typeof logoutResponseSchema>;
