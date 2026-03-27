import {
  blockedUsersTable,
  type DatabaseClient,
  userIdentitiesTable,
  userPreferencesTable,
  userPrivacySettingsTable,
  usersTable,
} from '@megaconvert/database';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, ne } from 'drizzle-orm';

import { DATABASE_CLIENT } from '../../database/database.constants';
import { UsersDomainError } from '../domain/users.errors';

import type { UsersRepository } from '../application/users.repository';
import type { GoogleIdentityProfile, UserAccount, UserAccountStatus } from '../domain/user-account';
import type {
  BlockedUserRecord,
  UserPreferences,
  UserPrivacySettings,
  UserProfileCard,
  VisibilityScope,
} from '../domain/user-profile-settings';
import type {
  UpdateUserPreferencesInput,
  UpdateUserPrivacySettingsInput,
  UpdateUserProfileInput,
} from '@megaconvert/contracts';

type DbExecutor = DatabaseClient;

@Injectable()
export class PostgresUsersRepository implements UsersRepository {
  public constructor(
    @Inject(DATABASE_CLIENT) private readonly databaseClient: DatabaseClient,
  ) {}

  public async blockByUsername(
    userId: string,
    username: string,
    note?: string | null,
  ): Promise<BlockedUserRecord> {
    const normalizedUsername = username.trim().toLowerCase();

    return this.databaseClient.transaction(async (transaction) => {
      const blockedUser = await transaction.query.usersTable.findFirst({
        where: eq(usersTable.username, normalizedUsername),
      });

      if (!blockedUser) {
        throw new UsersDomainError('blocked_user_not_found');
      }

      if (blockedUser.id === userId) {
        throw new UsersDomainError('cannot_block_self');
      }

      await transaction
        .insert(blockedUsersTable)
        .values({
          blockedUserId: blockedUser.id,
          blockedUserUsername: blockedUser.username,
          note: note?.trim() || null,
          userId,
        })
        .onConflictDoNothing({
          target: [blockedUsersTable.userId, blockedUsersTable.blockedUserId],
        });

      const blockedRows = await this.selectBlockedUsers(transaction, userId);
      const blockedRecord = blockedRows.find((row) => row.user.id === blockedUser.id);

      if (!blockedRecord) {
        throw new UsersDomainError('blocked_user_not_found');
      }

      return blockedRecord;
    });
  }

  public async findById(userId: string): Promise<UserAccount | null> {
    const row = await this.databaseClient.query.usersTable.findFirst({
      where: eq(usersTable.id, userId),
    });

    return row ? mapUserRow(row) : null;
  }

  public async findByUsername(username: string): Promise<UserAccount | null> {
    const row = await this.databaseClient.query.usersTable.findFirst({
      where: eq(usersTable.username, username.trim().toLowerCase()),
    });

    return row ? mapUserRow(row) : null;
  }

  public async getPreferences(userId: string): Promise<UserPreferences> {
    await this.ensurePreferenceRow(this.databaseClient, userId);

    const row = await this.databaseClient.query.userPreferencesTable.findFirst({
      where: eq(userPreferencesTable.userId, userId),
    });

    if (!row) {
      throw new UsersDomainError('user_not_found');
    }

    return mapPreferencesRow(row);
  }

  public async getPrivacySettings(userId: string): Promise<UserPrivacySettings> {
    await this.ensurePrivacyRow(this.databaseClient, userId);

    const row = await this.databaseClient.query.userPrivacySettingsTable.findFirst({
      where: eq(userPrivacySettingsTable.userId, userId),
    });

    if (!row) {
      throw new UsersDomainError('user_not_found');
    }

    return mapPrivacyRow(row);
  }

  public async listBlockedUsers(userId: string): Promise<BlockedUserRecord[]> {
    return this.selectBlockedUsers(this.databaseClient, userId);
  }

  public async listProfileCards(userIds: readonly string[]): Promise<UserProfileCard[]> {
    if (userIds.length === 0) {
      return [];
    }

    const rows = await this.databaseClient
      .select({
        avatarUrl: usersTable.avatarUrl,
        displayName: usersTable.displayName,
        id: usersTable.id,
        statusText: usersTable.statusText,
        username: usersTable.username,
      })
      .from(usersTable)
      .where(inArray(usersTable.id, [...new Set(userIds)]));

    return rows.map((row) => ({
      avatarUrl: row.avatarUrl,
      displayName: row.displayName,
      id: row.id,
      statusText: row.statusText,
      username: row.username,
    }));
  }

  public async unblockUser(userId: string, blockedUserId: string): Promise<boolean> {
    const result = await this.databaseClient
      .delete(blockedUsersTable)
      .where(
        and(
          eq(blockedUsersTable.userId, userId),
          eq(blockedUsersTable.blockedUserId, blockedUserId),
        ),
      )
      .returning({
        id: blockedUsersTable.id,
      });

    return result.length > 0;
  }

  public async updatePreferences(
    userId: string,
    input: UpdateUserPreferencesInput,
  ): Promise<UserPreferences> {
    await this.ensurePreferenceRow(this.databaseClient, userId);

    const now = new Date();

    const [row] = await this.databaseClient
      .update(userPreferencesTable)
      .set({
        ...pickDefined(normalizePreferencesUpdate(input)),
        updatedAt: now,
      })
      .where(eq(userPreferencesTable.userId, userId))
      .returning();

    if (!row) {
      throw new UsersDomainError('user_not_found');
    }

    return mapPreferencesRow(row);
  }

  public async updatePrivacySettings(
    userId: string,
    input: UpdateUserPrivacySettingsInput,
  ): Promise<UserPrivacySettings> {
    await this.ensurePrivacyRow(this.databaseClient, userId);

    const now = new Date();

    const [row] = await this.databaseClient
      .update(userPrivacySettingsTable)
      .set({
        ...pickDefined(normalizePrivacyUpdate(input)),
        updatedAt: now,
      })
      .where(eq(userPrivacySettingsTable.userId, userId))
      .returning();

    if (!row) {
      throw new UsersDomainError('user_not_found');
    }

    return mapPrivacyRow(row);
  }

  public async updateProfile(
    userId: string,
    input: UpdateUserProfileInput,
  ): Promise<UserAccount> {
    const now = new Date();
    const normalizedUsername = input.username?.trim().toLowerCase();

    if (normalizedUsername) {
      const conflictingUser = await this.databaseClient.query.usersTable.findFirst({
        where: and(
          eq(usersTable.username, normalizedUsername),
          ne(usersTable.id, userId),
        ),
      });

      if (conflictingUser) {
        throw new UsersDomainError('username_taken');
      }
    }

    const [row] = await this.databaseClient
      .update(usersTable)
      .set({
        ...pickDefined({
          avatarUrl: normalizeNullableString(input.avatarUrl),
          bio: normalizeNullableString(input.bio),
          displayName: input.displayName?.trim(),
          locale: normalizeNullableString(input.locale),
          statusText: normalizeNullableString(input.statusText),
          username: normalizedUsername,
        }),
        updatedAt: now,
      })
      .where(eq(usersTable.id, userId))
      .returning();

    if (!row) {
      throw new UsersDomainError('profile_update_failed');
    }

    return mapUserRow(row);
  }

  public async upsertGoogleIdentity(identityProfile: GoogleIdentityProfile): Promise<UserAccount> {
    const normalizedEmail = identityProfile.email.trim().toLowerCase();
    const now = new Date();

    return this.databaseClient.transaction(async (transaction) => {
      const existingIdentity = await transaction.query.userIdentitiesTable.findFirst({
        where: and(
          eq(userIdentitiesTable.provider, 'google_oidc'),
          eq(userIdentitiesTable.providerSubject, identityProfile.subject),
        ),
      });

      if (existingIdentity) {
        await this.updateExistingUser(transaction, existingIdentity.userId, identityProfile, now);
        await transaction
          .update(userIdentitiesTable)
          .set({
            email: normalizedEmail,
            lastAuthenticatedAt: now,
            profile: identityProfile.profile,
            updatedAt: now,
          })
          .where(eq(userIdentitiesTable.id, existingIdentity.id));

        await this.ensurePreferenceRow(transaction, existingIdentity.userId);
        await this.ensurePrivacyRow(transaction, existingIdentity.userId);

        const updatedUser = await transaction.query.usersTable.findFirst({
          where: eq(usersTable.id, existingIdentity.userId),
        });

        if (!updatedUser) {
          throw new UsersDomainError('user_not_found');
        }

        return mapUserRow(updatedUser);
      }

      const existingUser = await transaction.query.usersTable.findFirst({
        where: eq(usersTable.email, normalizedEmail),
      });

      const userId =
        existingUser?.id ??
        (
          await transaction
            .insert(usersTable)
            .values({
              avatarUrl: identityProfile.picture,
              bio: null,
              displayName: buildDisplayName(identityProfile),
              email: normalizedEmail,
              emailVerifiedAt: identityProfile.emailVerified ? now : null,
              familyName: identityProfile.familyName,
              givenName: identityProfile.givenName,
              lastAuthenticatedAt: now,
              locale: identityProfile.locale,
              statusText: null,
              updatedAt: now,
              username: await this.allocateUsername(transaction, normalizedEmail),
            })
            .returning({
              id: usersTable.id,
            })
        )[0]!.id;

      if (existingUser) {
        await this.updateExistingUser(transaction, existingUser.id, identityProfile, now);
      }

      await transaction.insert(userIdentitiesTable).values({
        email: normalizedEmail,
        lastAuthenticatedAt: now,
        profile: identityProfile.profile,
        provider: 'google_oidc',
        providerSubject: identityProfile.subject,
        updatedAt: now,
        userId,
      });

      await this.ensurePreferenceRow(transaction, userId);
      await this.ensurePrivacyRow(transaction, userId);

      const user = await transaction.query.usersTable.findFirst({
        where: eq(usersTable.id, userId),
      });

      if (!user) {
        throw new UsersDomainError('user_not_found');
      }

      return mapUserRow(user);
    });
  }

  private async allocateUsername(databaseClient: DbExecutor, email: string): Promise<string> {
    const [localPart] = email.split('@');
    const baseCandidate = sanitizeUsernameSeed(localPart ?? 'member');

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const suffix = attempt === 0 ? '' : String(attempt + 1);
      const candidate = `${baseCandidate.slice(0, Math.max(3, 32 - suffix.length))}${suffix}`;
      const existingUser = await databaseClient.query.usersTable.findFirst({
        where: eq(usersTable.username, candidate),
      });

      if (!existingUser) {
        return candidate;
      }
    }

    return `member${Date.now().toString().slice(-8)}`;
  }

  private async ensurePreferenceRow(databaseClient: DbExecutor, userId: string): Promise<void> {
    await databaseClient
      .insert(userPreferencesTable)
      .values({
        userId,
      })
      .onConflictDoNothing({
        target: userPreferencesTable.userId,
      });
  }

  private async ensurePrivacyRow(databaseClient: DbExecutor, userId: string): Promise<void> {
    await databaseClient
      .insert(userPrivacySettingsTable)
      .values({
        userId,
      })
      .onConflictDoNothing({
        target: userPrivacySettingsTable.userId,
      });
  }

  private async selectBlockedUsers(
    databaseClient: DbExecutor,
    userId: string,
  ): Promise<BlockedUserRecord[]> {
    const rows = await databaseClient
      .select({
        avatarUrl: usersTable.avatarUrl,
        blockedAt: blockedUsersTable.blockedAt,
        blockedUserId: blockedUsersTable.blockedUserId,
        displayName: usersTable.displayName,
        id: blockedUsersTable.id,
        note: blockedUsersTable.note,
        statusText: usersTable.statusText,
        username: usersTable.username,
      })
      .from(blockedUsersTable)
      .innerJoin(usersTable, eq(usersTable.id, blockedUsersTable.blockedUserId))
      .where(eq(blockedUsersTable.userId, userId))
      .orderBy(asc(usersTable.username));

    return rows.map((row) => ({
      blockedAt: row.blockedAt,
      id: row.id,
      note: row.note,
      user: {
        avatarUrl: row.avatarUrl,
        displayName: row.displayName,
        id: row.blockedUserId,
        statusText: row.statusText,
        username: row.username,
      },
    }));
  }

  private async updateExistingUser(
    databaseClient: DbExecutor,
    userId: string,
    identityProfile: GoogleIdentityProfile,
    now: Date,
  ): Promise<void> {
    await databaseClient
      .update(usersTable)
      .set({
        avatarUrl: identityProfile.picture,
        displayName: buildDisplayName(identityProfile),
        email: identityProfile.email.trim().toLowerCase(),
        emailVerifiedAt: identityProfile.emailVerified ? now : null,
        familyName: identityProfile.familyName,
        givenName: identityProfile.givenName,
        lastAuthenticatedAt: now,
        locale: identityProfile.locale,
        updatedAt: now,
      })
      .where(eq(usersTable.id, userId));
  }
}

function buildDisplayName(identityProfile: GoogleIdentityProfile): string {
  const parts = [identityProfile.givenName, identityProfile.familyName].filter(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  );

  if (parts.length > 0) {
    return parts.join(' ');
  }

  return identityProfile.email;
}

function mapUserRow(row: typeof usersTable.$inferSelect): UserAccount {
  return {
    accountStatus: row.accountStatus as UserAccountStatus,
    avatarUrl: row.avatarUrl,
    bio: row.bio,
    createdAt: row.createdAt,
    displayName: row.displayName,
    email: row.email,
    emailVerifiedAt: row.emailVerifiedAt,
    familyName: row.familyName,
    givenName: row.givenName,
    id: row.id,
    lastAuthenticatedAt: row.lastAuthenticatedAt,
    locale: row.locale,
    statusText: row.statusText,
    updatedAt: row.updatedAt,
    username: row.username,
  };
}

function mapPreferencesRow(row: typeof userPreferencesTable.$inferSelect): UserPreferences {
  return {
    compactModeEnabled: row.compactModeEnabled,
    defaultWorkspaceView: row.defaultWorkspaceView,
    keyboardShortcutsEnabled: row.keyboardShortcutsEnabled,
    localeOverride: row.localeOverride,
    playSoundEffects: row.playSoundEffects,
    preferredMeetingLayout: row.preferredMeetingLayout,
    timeZone: row.timeZone,
  };
}

function mapPrivacyRow(row: typeof userPrivacySettingsTable.$inferSelect): UserPrivacySettings {
  return {
    directMessageScope: row.directMessageScope as VisibilityScope,
    discoverableByEmail: row.discoverableByEmail,
    discoverableByUsername: row.discoverableByUsername,
    meetingPresenceScope: row.meetingPresenceScope as VisibilityScope,
    presenceScope: row.presenceScope as VisibilityScope,
    profileScope: row.profileScope as VisibilityScope,
    readReceiptsEnabled: row.readReceiptsEnabled,
  };
}

function normalizePrivacyUpdate(input: UpdateUserPrivacySettingsInput) {
  return {
    directMessageScope: input.directMessageScope,
    discoverableByEmail: input.discoverableByEmail,
    discoverableByUsername: input.discoverableByUsername,
    meetingPresenceScope: input.meetingPresenceScope,
    presenceScope: input.presenceScope,
    profileScope: input.profileScope,
    readReceiptsEnabled: input.readReceiptsEnabled,
  };
}

function normalizePreferencesUpdate(input: UpdateUserPreferencesInput) {
  return {
    compactModeEnabled: input.compactModeEnabled,
    defaultWorkspaceView: input.defaultWorkspaceView,
    keyboardShortcutsEnabled: input.keyboardShortcutsEnabled,
    localeOverride: input.localeOverride,
    playSoundEffects: input.playSoundEffects,
    preferredMeetingLayout: input.preferredMeetingLayout,
    timeZone: input.timeZone,
  };
}

function normalizeNullableString(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function pickDefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, candidate]) => candidate !== undefined),
  ) as Partial<T>;
}

function sanitizeUsernameSeed(value: string): string {
  const normalizedValue = value
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');

  const candidate = normalizedValue.length > 0 ? normalizedValue : 'member';

  if (!/^[a-z]/.test(candidate)) {
    return `m${candidate}`.slice(0, 32);
  }

  return candidate.slice(0, 32);
}
