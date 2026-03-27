import {
  blockUserRequestSchema,
  blockedUsersResponseSchema,
  createResponseEnvelopeSchema,
  updateUserPreferencesSchema,
  updateUserPrivacySettingsSchema,
  updateUserProfileSchema,
  userPreferencesSchema,
  userPrivacySettingsSchema,
  userProfileCardsResponseSchema,
  userProfileSchema,
  type BlockUserRequest,
  type BlockedUsersResponse,
  type UpdateUserPreferencesInput,
  type UpdateUserPrivacySettingsInput,
  type UpdateUserProfileInput,
  type UserPreferences,
  type UserPrivacySettings,
  type UserProfile,
  type UserProfileCardsResponse,
} from '@megaconvert/contracts';

import { createJsonClient, type JsonClient } from '../http/json-client';

const currentUserProfileEnvelopeSchema = createResponseEnvelopeSchema(userProfileSchema);
const userPrivacyEnvelopeSchema = createResponseEnvelopeSchema(userPrivacySettingsSchema);
const userPreferencesEnvelopeSchema = createResponseEnvelopeSchema(userPreferencesSchema);
const blockedUsersEnvelopeSchema = createResponseEnvelopeSchema(blockedUsersResponseSchema);
const profileCardsEnvelopeSchema = createResponseEnvelopeSchema(userProfileCardsResponseSchema);

export interface UsersClientOptions {
  baseUrl: string;
  client?: JsonClient;
}

export interface UsersClient {
  blockUser(input: BlockUserRequest): Promise<BlockedUsersResponse>;
  fetchBlockedUsers(): Promise<BlockedUsersResponse>;
  fetchCurrentProfile(): Promise<UserProfile>;
  fetchPreferences(): Promise<UserPreferences>;
  fetchPrivacySettings(): Promise<UserPrivacySettings>;
  fetchProfileCards(userIds: readonly string[]): Promise<UserProfileCardsResponse>;
  unblockUser(blockedUserId: string): Promise<BlockedUsersResponse>;
  updatePreferences(input: UpdateUserPreferencesInput): Promise<UserPreferences>;
  updatePrivacySettings(input: UpdateUserPrivacySettingsInput): Promise<UserPrivacySettings>;
  updateProfile(input: UpdateUserProfileInput): Promise<UserProfile>;
}

export function createUsersClient(options: UsersClientOptions): UsersClient {
  const client =
    options.client ??
    createJsonClient({
      baseUrl: options.baseUrl,
      timeoutMs: 8_000,
    });

  return {
    async blockUser(input) {
      const payload = await client.post('/users/me/blocked-users', {
        body: blockUserRequestSchema.parse(input),
        credentials: 'include',
        schema: blockedUsersEnvelopeSchema,
      });

      return payload.data;
    },
    async fetchBlockedUsers() {
      const payload = await client.get('/users/me/blocked-users', {
        credentials: 'include',
        schema: blockedUsersEnvelopeSchema,
      });

      return payload.data;
    },
    async fetchCurrentProfile() {
      const payload = await client.get('/users/me', {
        credentials: 'include',
        schema: currentUserProfileEnvelopeSchema,
      });

      return payload.data;
    },
    async fetchPreferences() {
      const payload = await client.get('/users/me/preferences', {
        credentials: 'include',
        schema: userPreferencesEnvelopeSchema,
      });

      return payload.data;
    },
    async fetchPrivacySettings() {
      const payload = await client.get('/users/me/privacy', {
        credentials: 'include',
        schema: userPrivacyEnvelopeSchema,
      });

      return payload.data;
    },
    async fetchProfileCards(userIds) {
      const payload = await client.get('/users/profile-cards', {
        credentials: 'include',
        query: {
          ids: userIds.join(','),
        },
        schema: profileCardsEnvelopeSchema,
      });

      return payload.data;
    },
    async unblockUser(blockedUserId) {
      const payload = await client.delete(`/users/me/blocked-users/${blockedUserId}`, {
        credentials: 'include',
        schema: blockedUsersEnvelopeSchema,
      });

      return payload.data;
    },
    async updatePreferences(input) {
      const payload = await client.put('/users/me/preferences', {
        body: updateUserPreferencesSchema.parse(input),
        credentials: 'include',
        schema: userPreferencesEnvelopeSchema,
      });

      return payload.data;
    },
    async updatePrivacySettings(input) {
      const payload = await client.put('/users/me/privacy', {
        body: updateUserPrivacySettingsSchema.parse(input),
        credentials: 'include',
        schema: userPrivacyEnvelopeSchema,
      });

      return payload.data;
    },
    async updateProfile(input) {
      const payload = await client.patch('/users/me/profile', {
        body: updateUserProfileSchema.parse(input),
        credentials: 'include',
        schema: currentUserProfileEnvelopeSchema,
      });

      return payload.data;
    },
  };
}
