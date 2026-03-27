import { Inject, Injectable } from '@nestjs/common';

import { USERS_REPOSITORY } from '../users.constants';

import type { UsersRepository } from './users.repository';
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

@Injectable()
export class UsersService {
  public constructor(
    @Inject(USERS_REPOSITORY) private readonly usersRepository: UsersRepository,
  ) {}

  public async findById(userId: string): Promise<UserAccount | null> {
    return this.usersRepository.findById(userId);
  }

  public async findByUsername(username: string): Promise<UserAccount | null> {
    return this.usersRepository.findByUsername(username);
  }

  public async getPreferences(userId: string): Promise<UserPreferences> {
    return this.usersRepository.getPreferences(userId);
  }

  public async getPrivacySettings(userId: string): Promise<UserPrivacySettings> {
    return this.usersRepository.getPrivacySettings(userId);
  }

  public async listBlockedUsers(userId: string): Promise<BlockedUserRecord[]> {
    return this.usersRepository.listBlockedUsers(userId);
  }

  public async listProfileCards(userIds: readonly string[]): Promise<UserProfileCard[]> {
    return this.usersRepository.listProfileCards(userIds);
  }

  public async blockByUsername(
    userId: string,
    username: string,
    note?: string | null,
  ): Promise<BlockedUserRecord> {
    return this.usersRepository.blockByUsername(userId, username, note);
  }

  public async unblockUser(userId: string, blockedUserId: string): Promise<boolean> {
    return this.usersRepository.unblockUser(userId, blockedUserId);
  }

  public async updatePreferences(
    userId: string,
    input: UpdateUserPreferencesInput,
  ): Promise<UserPreferences> {
    return this.usersRepository.updatePreferences(userId, input);
  }

  public async updatePrivacySettings(
    userId: string,
    input: UpdateUserPrivacySettingsInput,
  ): Promise<UserPrivacySettings> {
    return this.usersRepository.updatePrivacySettings(userId, input);
  }

  public async updateProfile(
    userId: string,
    input: UpdateUserProfileInput,
  ): Promise<UserAccount> {
    return this.usersRepository.updateProfile(userId, input);
  }

  public async upsertGoogleIdentity(identityProfile: GoogleIdentityProfile): Promise<UserAccount> {
    return this.usersRepository.upsertGoogleIdentity(identityProfile);
  }
}
