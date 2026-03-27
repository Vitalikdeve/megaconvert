import { z } from 'zod';

import { userProfileCardSchema } from './profile';
import { usernameSchema } from './shared';

export const blockedUserSchema = z.object({
  blockedAt: z.string().datetime(),
  id: z.string().uuid(),
  note: z.string().min(1).nullable(),
  user: userProfileCardSchema,
});

export const blockUserRequestSchema = z
  .object({
    note: z.string().trim().max(120).nullable().optional(),
    username: usernameSchema,
  })
  .strict();

export const blockedUsersResponseSchema = z.object({
  blockedUsers: z.array(blockedUserSchema),
});

export type BlockUserRequest = z.infer<typeof blockUserRequestSchema>;
export type BlockedUser = z.infer<typeof blockedUserSchema>;
export type BlockedUsersResponse = z.infer<typeof blockedUsersResponseSchema>;
