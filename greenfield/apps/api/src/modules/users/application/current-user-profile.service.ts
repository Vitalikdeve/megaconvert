import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AuditShellService } from '../../audit-shell/application/audit-shell.service';
import { UsersDomainError } from '../domain/users.errors';

import { UsersService } from './users.service';

import type { UserAccount } from '../domain/user-account';
import type { UserProfileCard } from '../domain/user-profile-settings';
import type {
  BlockedUsersResponse,
  BlockUserRequest,
  UpdateUserPreferencesInput,
  UpdateUserPrivacySettingsInput,
  UpdateUserProfileInput,
  UserPreferences,
  UserPrivacySettings,
  UserProfile,
} from '@megaconvert/contracts';

@Injectable()
export class CurrentUserProfileService {
  public constructor(
    @Inject(AuditShellService)
    private readonly auditShellService: AuditShellService,
    @Inject(UsersService)
    private readonly usersService: UsersService,
  ) {}

  public async blockUser(userId: string, input: BlockUserRequest): Promise<BlockedUsersResponse> {
    const currentUser = await this.requireActiveUser(userId);

    try {
      const blockedUser = await this.usersService.blockByUsername(
        currentUser.id,
        input.username,
        input.note,
      );

      await this.auditShellService.record({
        action: 'user.blocked',
        category: 'user_profile',
        metadata: {
          blockedUserId: blockedUser.user.id,
          blockedUsername: blockedUser.user.username,
          note: blockedUser.note,
        },
        target: {
          id: blockedUser.user.id,
          type: 'user',
        },
      });

      return {
        blockedUsers: await this.listBlockedUsers(currentUser.id),
      };
    } catch (error) {
      this.throwMappedUsersError(error);
    }
  }

  public async getCurrentUserProfile(userId: string): Promise<UserProfile> {
    return mapUserToProfile(await this.requireActiveUser(userId));
  }

  public async getPreferences(userId: string): Promise<UserPreferences> {
    await this.requireActiveUser(userId);
    return this.usersService.getPreferences(userId);
  }

  public async getPrivacySettings(userId: string): Promise<UserPrivacySettings> {
    await this.requireActiveUser(userId);
    return this.usersService.getPrivacySettings(userId);
  }

  public async listBlockedUsers(userId: string): Promise<BlockedUsersResponse['blockedUsers']> {
    await this.requireActiveUser(userId);

    const blockedUsers = await this.usersService.listBlockedUsers(userId);

    return blockedUsers.map((blockedUser) => ({
      blockedAt: blockedUser.blockedAt.toISOString(),
      id: blockedUser.id,
      note: blockedUser.note,
      user: blockedUser.user,
    }));
  }

  public async unblockUser(
    userId: string,
    blockedUserId: string,
  ): Promise<BlockedUsersResponse> {
    const currentUser = await this.requireActiveUser(userId);
    const removed = await this.usersService.unblockUser(currentUser.id, blockedUserId);

    if (!removed) {
      throw new NotFoundException({
        code: 'blocked_user_not_found',
        message: 'The blocked user entry could not be found.',
      });
    }

    await this.auditShellService.record({
      action: 'user.unblocked',
      category: 'user_profile',
      metadata: {
        blockedUserId,
      },
      target: {
        id: blockedUserId,
        type: 'user',
      },
    });

    return {
      blockedUsers: await this.listBlockedUsers(currentUser.id),
    };
  }

  public async updatePreferences(
    userId: string,
    input: UpdateUserPreferencesInput,
  ): Promise<UserPreferences> {
    const currentUser = await this.requireActiveUser(userId);
    const preferences = await this.usersService.updatePreferences(currentUser.id, input);

    await this.auditShellService.record({
      action: 'user.preferences.updated',
      category: 'user_profile',
      metadata: {
        updatedFields: Object.keys(input),
      },
      target: {
        id: currentUser.id,
        type: 'user',
      },
    });

    return preferences;
  }

  public async updatePrivacySettings(
    userId: string,
    input: UpdateUserPrivacySettingsInput,
  ): Promise<UserPrivacySettings> {
    const currentUser = await this.requireActiveUser(userId);
    const privacySettings = await this.usersService.updatePrivacySettings(currentUser.id, input);

    await this.auditShellService.record({
      action: 'user.privacy.updated',
      category: 'user_profile',
      metadata: {
        updatedFields: Object.keys(input),
      },
      target: {
        id: currentUser.id,
        type: 'user',
      },
    });

    return privacySettings;
  }

  public async updateProfile(
    userId: string,
    input: UpdateUserProfileInput,
  ): Promise<UserProfile> {
    const currentUser = await this.requireActiveUser(userId);

    try {
      const updatedUser = await this.usersService.updateProfile(currentUser.id, input);

      await this.auditShellService.record({
        action: 'user.profile.updated',
        category: 'user_profile',
        metadata: {
          updatedFields: Object.keys(input),
        },
        target: {
          id: currentUser.id,
          type: 'user',
        },
      });

      return mapUserToProfile(updatedUser);
    } catch (error) {
      this.throwMappedUsersError(error);
    }
  }

  public async validateCurrentUser(userId: string): Promise<void> {
    await this.requireActiveUser(userId);
  }

  private async requireActiveUser(userId: string): Promise<UserAccount> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new NotFoundException({
        code: 'user_not_found',
        message: 'The current user profile could not be found.',
      });
    }

    if (user.accountStatus !== 'active') {
      throw new ForbiddenException({
        code: 'account_inactive',
        message: 'The account is not available for profile operations.',
      });
    }

    return user;
  }

  private throwMappedUsersError(error: unknown): never {
    if (!(error instanceof UsersDomainError)) {
      throw error;
    }

    switch (error.code) {
      case 'blocked_user_not_found':
        throw new NotFoundException({
          code: error.code,
          message: 'The requested user could not be found.',
        });
      case 'cannot_block_self':
        throw new BadRequestException({
          code: error.code,
          message: 'You cannot block your own account.',
        });
      case 'username_taken':
        throw new ConflictException({
          code: error.code,
          message: 'That username is already in use.',
        });
      case 'profile_update_failed':
      case 'user_not_found':
        throw new NotFoundException({
          code: error.code,
          message: 'The current user profile could not be found.',
        });
      default:
        throw error;
    }
  }
}

function mapUserToProfile(user: UserAccount): UserProfile {
  return {
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    displayName: user.displayName,
    email: user.email,
    id: user.id,
    locale: user.locale,
    statusText: user.statusText,
    username: user.username,
  };
}

export function mapUserToProfileCard(user: UserAccount): UserProfileCard {
  return {
    avatarUrl: user.avatarUrl,
    displayName: user.displayName,
    id: user.id,
    statusText: user.statusText,
    username: user.username,
  };
}
