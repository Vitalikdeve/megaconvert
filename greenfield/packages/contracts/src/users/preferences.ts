import { z } from 'zod';

import { defaultWorkspaceViewSchema, preferredMeetingLayoutSchema } from './shared';

export const userPreferencesSchema = z.object({
  compactModeEnabled: z.boolean(),
  defaultWorkspaceView: defaultWorkspaceViewSchema,
  keyboardShortcutsEnabled: z.boolean(),
  localeOverride: z.string().min(1).nullable(),
  playSoundEffects: z.boolean(),
  preferredMeetingLayout: preferredMeetingLayoutSchema,
  timeZone: z.string().min(1).nullable(),
});

export const updateUserPreferencesSchema = userPreferencesSchema.partial().strict().refine(
  (value) => Object.keys(value).length > 0,
  {
    message: 'At least one preference must be provided.',
  },
);

export type UpdateUserPreferencesInput = z.infer<typeof updateUserPreferencesSchema>;
export type UserPreferences = z.infer<typeof userPreferencesSchema>;
