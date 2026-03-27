import { z } from 'zod';

import { visibilityScopeSchema } from './shared';

export const userPrivacySettingsSchema = z.object({
  directMessageScope: visibilityScopeSchema,
  discoverableByEmail: z.boolean(),
  discoverableByUsername: z.boolean(),
  meetingPresenceScope: visibilityScopeSchema,
  presenceScope: visibilityScopeSchema,
  profileScope: visibilityScopeSchema,
  readReceiptsEnabled: z.boolean(),
});

export const updateUserPrivacySettingsSchema = userPrivacySettingsSchema.partial().strict().refine(
  (value) => Object.keys(value).length > 0,
  {
    message: 'At least one privacy setting must be provided.',
  },
);

export type UpdateUserPrivacySettingsInput = z.infer<typeof updateUserPrivacySettingsSchema>;
export type UserPrivacySettings = z.infer<typeof userPrivacySettingsSchema>;
