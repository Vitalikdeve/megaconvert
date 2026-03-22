import { randomUUID } from "node:crypto";

import type {
  AuthUserProfile,
  AuthUserRecord,
  AuthUserRepository
} from "../domain/auth-user.entity";

import { createRedisClient, ensureRedisConnection } from "../../../core/redis";

const normalizeUsername = (value: string) => value.trim().toLowerCase();

const toProfile = (user: AuthUserRecord): AuthUserProfile => ({
  id: user.id,
  username: user.username,
  displayName: user.displayName,
  createdAt: user.createdAt
});

const userKey = (userId: string) => `messenger:auth:user:${userId}`;
const usernameKey = (username: string) =>
  `messenger:auth:user:username:${normalizeUsername(username)}`;
const userSetKey = "messenger:auth:users";

export class InMemoryAuthRepository implements AuthUserRepository {
  private readonly usersById = new Map<string, AuthUserRecord>();

  private readonly usernames = new Map<string, string>();

  async create(input: {
    username: string;
    displayName: string;
    passwordHash: string;
  }): Promise<AuthUserRecord> {
    const normalized = normalizeUsername(input.username);

    if (this.usernames.has(normalized)) {
      throw new Error("username_taken");
    }

    const user: AuthUserRecord = {
      id: randomUUID(),
      username: normalized,
      displayName: input.displayName,
      passwordHash: input.passwordHash,
      createdAt: new Date().toISOString()
    };

    this.usernames.set(normalized, user.id);
    this.usersById.set(user.id, user);
    return user;
  }

  async findByUsername(username: string) {
    const userId = this.usernames.get(normalizeUsername(username));
    return userId ? (this.usersById.get(userId) ?? null) : null;
  }

  async findById(userId: string) {
    return this.usersById.get(userId) ?? null;
  }

  async list(query?: string) {
    const normalized = query?.trim().toLowerCase();

    return Array.from(this.usersById.values())
      .map(toProfile)
      .filter((user) =>
        normalized
          ? user.username.includes(normalized) ||
            user.displayName.toLowerCase().includes(normalized)
          : true
      )
      .sort((left, right) => left.username.localeCompare(right.username));
  }
}

export class RedisAuthRepository implements AuthUserRepository {
  private readonly redis;

  constructor(private readonly redisUrl: string) {
    this.redis = createRedisClient(redisUrl, "messenger-auth-repository");
  }

  async create(input: {
    username: string;
    displayName: string;
    passwordHash: string;
  }): Promise<AuthUserRecord> {
    await ensureRedisConnection(this.redis);

    const normalized = normalizeUsername(input.username);
    const existingId = await this.redis.get(usernameKey(normalized));

    if (existingId) {
      throw new Error("username_taken");
    }

    const user: AuthUserRecord = {
      id: randomUUID(),
      username: normalized,
      displayName: input.displayName,
      passwordHash: input.passwordHash,
      createdAt: new Date().toISOString()
    };

    const result = await this.redis
      .multi()
      .setnx(usernameKey(normalized), user.id)
      .set(userKey(user.id), JSON.stringify(user))
      .sadd(userSetKey, user.id)
      .exec();

    if (!result || result[0]?.[1] !== 1) {
      throw new Error("username_taken");
    }

    return user;
  }

  async findByUsername(username: string) {
    await ensureRedisConnection(this.redis);
    const userId = await this.redis.get(usernameKey(username));
    return userId ? this.findById(userId) : null;
  }

  async findById(userId: string) {
    await ensureRedisConnection(this.redis);
    const payload = await this.redis.get(userKey(userId));

    return payload ? (JSON.parse(payload) as AuthUserRecord) : null;
  }

  async list(query?: string) {
    await ensureRedisConnection(this.redis);
    const ids = await this.redis.smembers(userSetKey);

    if (ids.length === 0) {
      return [];
    }

    const payloads = await this.redis.mget(ids.map((id) => userKey(id)));
    const normalized = query?.trim().toLowerCase();

    return payloads
      .filter((payload): payload is string => Boolean(payload))
      .map((payload) => JSON.parse(payload) as AuthUserRecord)
      .map(toProfile)
      .filter((user) =>
        normalized
          ? user.username.includes(normalized) ||
            user.displayName.toLowerCase().includes(normalized)
          : true
      )
      .sort((left, right) => left.username.localeCompare(right.username));
  }

  async close() {
    if (this.redis.status !== "end") {
      await this.redis.quit();
    }
  }
}
