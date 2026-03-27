import type { GoogleIdentityProfile, UserAccount } from '../domain/user-account';
import type {
  BlockedUserRecord,
  UserPreferences,
  UserPrivacySettings,
  UserProfileCard,
} from '../domain/user-profile-settings';
import type {
  UpdateUserPreferencesInput,
  UpdateUserPrivacySettingsInput,
  UpdateUserProfileInput,
} from '@megaconvert/contracts';

export interface UsersRepository {
  blockByUsername(userId: string, username: string, note?: string | null): Promise<BlockedUserRecord>;
  findById(userId: string): Promise<UserAccount | null>;
  findByUsername(username: string): Promise<UserAccount | null>;
  getPreferences(userId: string): Promise<UserPreferences>;
  getPrivacySettings(userId: string): Promise<UserPrivacySettings>;
  listBlockedUsers(userId: string): Promise<BlockedUserRecord[]>;
  listProfileCards(userIds: readonly string[]): Promise<UserProfileCard[]>;
  unblockUser(userId: string, blockedUserId: string): Promise<boolean>;
  updatePreferences(userId: string, input: UpdateUserPreferencesInput): Promise<UserPreferences>;
  updatePrivacySettings(
    userId: string,
    input: UpdateUserPrivacySettingsInput,
  ): Promise<UserPrivacySettings>;
  updateProfile(userId: string, input: UpdateUserProfileInput): Promise<UserAccount>;
  upsertGoogleIdentity(identityProfile: GoogleIdentityProfile): Promise<UserAccount>;
}
