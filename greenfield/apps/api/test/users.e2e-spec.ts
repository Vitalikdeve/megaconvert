import request from 'supertest';

import { ACTOR_RESOLVER } from '../src/modules/auth-shell/auth-shell.constants';
import { UsersDomainError } from '../src/modules/users/domain/users.errors';
import { USERS_REPOSITORY } from '../src/modules/users/users.constants';

import { createOverriddenTestApiApp } from './support/create-overridden-test-api-app';
import { createTestApiApp } from './support/create-test-api-app';

import type { ActorResolver } from '../src/modules/auth-shell/application/actor-resolver.port';
import type { RequestActor } from '../src/modules/auth-shell/domain/request-actor';
import type { UsersRepository } from '../src/modules/users/application/users.repository';
import type { UserAccount } from '../src/modules/users/domain/user-account';
import type {
  BlockedUserRecord,
  UserPreferences,
  UserPrivacySettings,
  UserProfileCard,
} from '../src/modules/users/domain/user-profile-settings';
import type { UpdateUserProfileInput } from '@megaconvert/contracts';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

const currentUserId = '11111111-1111-4111-8111-111111111111';
const sessionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const blockedCandidateId = '22222222-2222-4222-8222-222222222222';

describe('user/profile endpoints', () => {
  let authenticatedApp: NestFastifyApplication;
  let anonymousApp: NestFastifyApplication;

  beforeAll(async () => {
    anonymousApp = await createTestApiApp();
    authenticatedApp = await createOverriddenTestApiApp(
      {},
      [
        {
          provide: ACTOR_RESOLVER,
          useValue: buildActorResolver(),
        },
        {
          provide: USERS_REPOSITORY,
          useValue: buildUsersRepositoryStub(),
        },
      ],
    );
  });

  afterAll(async () => {
    await Promise.all([authenticatedApp.close(), anonymousApp.close()]);
  });

  it('rejects current-user routes without an authenticated user actor', async () => {
    const response = await request(anonymousApp.getHttpServer()).get('/users/me').expect(403);

    expect(response.body.error.message).toBe('A user session is required for this operation.');
    expect(response.body.error.code).toBe('user_actor_required');
  });

  it('returns the current user profile', async () => {
    const response = await request(authenticatedApp.getHttpServer()).get('/users/me').expect(200);

    expect(response.body.data).toEqual(
      expect.objectContaining({
        displayName: 'Alex Mercer',
        id: currentUserId,
        username: 'alex_mercer',
      }),
    );
    expect(response.body.meta.requestId).toEqual(expect.any(String));
  });

  it('updates the current user profile', async () => {
    const response = await request(authenticatedApp.getHttpServer())
      .patch('/users/me/profile')
      .send({
        bio: 'Leading product conversations across chat and meeting workflows.',
        displayName: 'Alex Mercer Prime',
        username: 'alex_prime',
      })
      .expect(200);

    expect(response.body.data).toEqual(
      expect.objectContaining({
        bio: 'Leading product conversations across chat and meeting workflows.',
        displayName: 'Alex Mercer Prime',
        username: 'alex_prime',
      }),
    );
  });

  it('blocks and unblocks users by username', async () => {
    const blockResponse = await request(authenticatedApp.getHttpServer())
      .post('/users/me/blocked-users')
      .send({
        note: 'Escalated safety case',
        username: 'blocked_member',
      })
      .expect(201);

    expect(blockResponse.body.data.blockedUsers).toHaveLength(1);
    expect(blockResponse.body.data.blockedUsers[0].user.username).toBe('blocked_member');

    const unblockResponse = await request(authenticatedApp.getHttpServer())
      .delete(`/users/me/blocked-users/${blockedCandidateId}`)
      .expect(200);

    expect(unblockResponse.body.data.blockedUsers).toEqual([]);
  });

  it('updates privacy and preferences', async () => {
    const privacyResponse = await request(authenticatedApp.getHttpServer())
      .put('/users/me/privacy')
      .send({
        directMessageScope: 'contacts_only',
        readReceiptsEnabled: false,
      })
      .expect(200);

    expect(privacyResponse.body.data.directMessageScope).toBe('contacts_only');
    expect(privacyResponse.body.data.readReceiptsEnabled).toBe(false);

    const preferencesResponse = await request(authenticatedApp.getHttpServer())
      .put('/users/me/preferences')
      .send({
        compactModeEnabled: true,
        defaultWorkspaceView: 'meetings',
      })
      .expect(200);

    expect(preferencesResponse.body.data.compactModeEnabled).toBe(true);
    expect(preferencesResponse.body.data.defaultWorkspaceView).toBe('meetings');
  });

  it('returns profile cards for chat and meeting surfaces', async () => {
    const response = await request(authenticatedApp.getHttpServer())
      .get(`/users/profile-cards?ids=${currentUserId},${blockedCandidateId}`)
      .expect(200);

    expect(response.body.data.profiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: currentUserId,
          username: 'alex_prime',
        }),
        expect.objectContaining({
          id: blockedCandidateId,
          username: 'blocked_member',
        }),
      ]),
    );
  });
});

function buildActorResolver(): ActorResolver {
  return {
    async resolve(): Promise<RequestActor> {
      return {
        id: currentUserId,
        isAuthenticated: true,
        kind: 'user',
        sessionId,
      };
    },
  };
}

function buildUsersRepositoryStub(): UsersRepository {
  const currentUser: UserAccount = {
    accountStatus: 'active',
    avatarUrl: 'https://cdn.example.com/avatars/alex.png',
    bio: 'Designs the connective tissue between messaging and meetings.',
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    displayName: 'Alex Mercer',
    email: 'alex@example.com',
    emailVerifiedAt: new Date('2026-01-01T10:00:00.000Z'),
    familyName: 'Mercer',
    givenName: 'Alex',
    id: currentUserId,
    lastAuthenticatedAt: new Date('2026-03-27T10:00:00.000Z'),
    locale: 'en',
    statusText: 'Available for planning',
    updatedAt: new Date('2026-03-27T10:00:00.000Z'),
    username: 'alex_mercer',
  };
  const blockedCandidate: UserProfileCard = {
    avatarUrl: null,
    displayName: 'Blocked Member',
    id: blockedCandidateId,
    statusText: 'Offline',
    username: 'blocked_member',
  };
  let preferences: UserPreferences = {
    compactModeEnabled: false,
    defaultWorkspaceView: 'inbox',
    keyboardShortcutsEnabled: true,
    localeOverride: null,
    playSoundEffects: true,
    preferredMeetingLayout: 'grid',
    timeZone: 'Europe/Minsk',
  };
  let privacy: UserPrivacySettings = {
    directMessageScope: 'everyone',
    discoverableByEmail: true,
    discoverableByUsername: true,
    meetingPresenceScope: 'everyone',
    presenceScope: 'everyone',
    profileScope: 'everyone',
    readReceiptsEnabled: true,
  };
  let blockedUsers: BlockedUserRecord[] = [];

  return {
    async blockByUsername(userId, username, note) {
      if (userId !== currentUser.id) {
        throw new UsersDomainError('user_not_found');
      }

      if (username === currentUser.username) {
        throw new UsersDomainError('cannot_block_self');
      }

      if (username !== blockedCandidate.username) {
        throw new UsersDomainError('blocked_user_not_found');
      }

      const existingRecord = blockedUsers.find((entry) => entry.user.id === blockedCandidate.id);

      if (existingRecord) {
        return existingRecord;
      }

      const record: BlockedUserRecord = {
        blockedAt: new Date('2026-03-27T12:00:00.000Z'),
        id: '33333333-3333-4333-8333-333333333333',
        note: note ?? null,
        user: blockedCandidate,
      };

      blockedUsers = [record];
      return record;
    },
    async findById(userId) {
      return userId === currentUser.id ? currentUser : null;
    },
    async findByUsername(username) {
      if (username === currentUser.username) {
        return currentUser;
      }

      if (username === blockedCandidate.username) {
        return {
          ...currentUser,
          avatarUrl: blockedCandidate.avatarUrl,
          displayName: blockedCandidate.displayName,
          email: 'blocked@example.com',
          familyName: 'Member',
          givenName: 'Blocked',
          id: blockedCandidate.id,
          statusText: blockedCandidate.statusText,
          username: blockedCandidate.username,
        };
      }

      return null;
    },
    async getPreferences(userId) {
      if (userId !== currentUser.id) {
        throw new UsersDomainError('user_not_found');
      }

      return preferences;
    },
    async getPrivacySettings(userId) {
      if (userId !== currentUser.id) {
        throw new UsersDomainError('user_not_found');
      }

      return privacy;
    },
    async listBlockedUsers(userId) {
      return userId === currentUser.id ? blockedUsers : [];
    },
    async listProfileCards(userIds) {
      return [currentUser, blockedCandidate]
        .filter((profile) => userIds.includes(profile.id))
        .map((profile) => ({
          avatarUrl: profile.avatarUrl,
          displayName: profile.displayName,
          id: profile.id,
          statusText: profile.statusText,
          username: profile.username,
        }));
    },
    async unblockUser(userId, blockedUserId) {
      if (userId !== currentUser.id) {
        return false;
      }

      const previousLength = blockedUsers.length;
      blockedUsers = blockedUsers.filter((entry) => entry.user.id !== blockedUserId);
      return blockedUsers.length !== previousLength;
    },
    async updatePreferences(userId, input) {
      if (userId !== currentUser.id) {
        throw new UsersDomainError('user_not_found');
      }

      preferences = {
        ...preferences,
        ...input,
      };

      return preferences;
    },
    async updatePrivacySettings(userId, input) {
      if (userId !== currentUser.id) {
        throw new UsersDomainError('user_not_found');
      }

      privacy = {
        ...privacy,
        ...input,
      };

      return privacy;
    },
    async updateProfile(userId, input: UpdateUserProfileInput) {
      if (userId !== currentUser.id) {
        throw new UsersDomainError('profile_update_failed');
      }

      if (input.username === blockedCandidate.username) {
        throw new UsersDomainError('username_taken');
      }

      currentUser.avatarUrl = normalizeNullable(input.avatarUrl, currentUser.avatarUrl);
      currentUser.bio = normalizeNullable(input.bio, currentUser.bio);
      currentUser.displayName = input.displayName?.trim() || currentUser.displayName;
      currentUser.locale = normalizeNullable(input.locale, currentUser.locale);
      currentUser.statusText = normalizeNullable(input.statusText, currentUser.statusText);
      currentUser.username = input.username?.trim().toLowerCase() || currentUser.username;
      currentUser.updatedAt = new Date('2026-03-27T12:30:00.000Z');

      return currentUser;
    },
    async upsertGoogleIdentity() {
      return currentUser;
    },
  };
}

function normalizeNullable(value: string | null | undefined, fallback: string | null): string | null {
  if (value === undefined) {
    return fallback;
  }

  return value;
}
