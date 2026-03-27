import { z } from 'zod';

export const authenticatedUserSchema = z.object({
  avatarUrl: z.string().url().nullable(),
  displayName: z.string().min(1),
  email: z.string().email(),
  emailVerified: z.boolean(),
  familyName: z.string().min(1).nullable(),
  givenName: z.string().min(1).nullable(),
  id: z.string().uuid(),
  locale: z.string().min(1).nullable(),
});

export type AuthenticatedUser = z.infer<typeof authenticatedUserSchema>;
