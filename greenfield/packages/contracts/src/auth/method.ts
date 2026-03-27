import { z } from 'zod';

export const authenticationMethodSchema = z.enum(['google_oidc', 'webauthn_passkey']);

export const authSessionStatusSchema = z.enum(['active', 'revoked']);

export const authDeviceKindSchema = z.enum(['desktop', 'mobile', 'tablet', 'unknown']);

export type AuthenticationMethod = z.infer<typeof authenticationMethodSchema>;
export type AuthSessionStatus = z.infer<typeof authSessionStatusSchema>;
export type AuthDeviceKind = z.infer<typeof authDeviceKindSchema>;
