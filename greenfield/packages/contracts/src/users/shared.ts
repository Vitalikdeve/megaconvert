import { z } from 'zod';

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z][a-z0-9_]{2,31}$/, {
    message:
      'Username must start with a letter and contain only lowercase letters, numbers, and underscores.',
  });

export const displayNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), {
    message: 'Display name contains unsupported control characters.',
  });

export const bioSchema = z.string().trim().max(240);

export const statusTextSchema = z.string().trim().max(80);

export const visibilityScopeSchema = z.enum(['contacts_only', 'everyone', 'nobody']);

export const defaultWorkspaceViewSchema = z.enum(['inbox', 'meetings', 'search']);

export const preferredMeetingLayoutSchema = z.enum(['grid', 'spotlight']);

export type DefaultWorkspaceView = z.infer<typeof defaultWorkspaceViewSchema>;
export type PreferredMeetingLayout = z.infer<typeof preferredMeetingLayoutSchema>;
export type VisibilityScope = z.infer<typeof visibilityScopeSchema>;
