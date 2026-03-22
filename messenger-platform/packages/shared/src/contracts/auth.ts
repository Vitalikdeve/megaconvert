import { z } from "zod";

export const authCredentialsSchema = z.object({
  username: z.string().trim().min(3).max(32),
  password: z.string().min(8).max(256)
});

export const authUserSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
  displayName: z.string().min(1),
  createdAt: z.string().datetime()
});

export const authSessionSchema = z.object({
  user: authUserSchema,
  userId: z.string().min(1),
  accessToken: z.string().min(1),
  token: z.string().min(1),
  deviceId: z.string().min(1),
  expiresAt: z.string().datetime()
});

export const usersQuerySchema = z.object({
  q: z.string().trim().max(64).optional()
});

export const jwtClaimsSchema = z.object({
  userId: z.string().min(1),
  username: z.string().min(1),
  deviceId: z.string().min(1)
});

export type AuthCredentials = z.infer<typeof authCredentialsSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
export type AuthSession = z.infer<typeof authSessionSchema>;
export type UsersQuery = z.infer<typeof usersQuerySchema>;
export type JwtClaims = z.infer<typeof jwtClaimsSchema>;
