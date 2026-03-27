import { z } from 'zod';

import { bioSchema, displayNameSchema, statusTextSchema, usernameSchema } from './shared';

export const userProfileCardSchema = z.object({
  avatarUrl: z.string().url().nullable(),
  displayName: displayNameSchema,
  id: z.string().uuid(),
  statusText: statusTextSchema.nullable(),
  username: usernameSchema,
});

export const userProfileSchema = userProfileCardSchema.extend({
  bio: bioSchema.nullable(),
  email: z.string().email(),
  locale: z.string().min(1).nullable(),
});

export const updateUserProfileSchema = z
  .object({
    avatarUrl: z.string().trim().url().nullable().optional(),
    bio: bioSchema.nullable().optional(),
    displayName: displayNameSchema.optional(),
    locale: z.string().trim().min(2).max(16).nullable().optional(),
    statusText: statusTextSchema.nullable().optional(),
    username: usernameSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one profile field must be provided.',
  });

export const userProfileCardsResponseSchema = z.object({
  profiles: z.array(userProfileCardSchema),
});

export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
export type UserProfileCard = z.infer<typeof userProfileCardSchema>;
export type UserProfileCardsResponse = z.infer<typeof userProfileCardsResponseSchema>;
