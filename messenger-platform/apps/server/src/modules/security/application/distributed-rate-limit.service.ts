import { createHash } from "node:crypto";

import type Redis from "ioredis";

import { ensureRedisConnection } from "../../../core/redis";

interface RateLimitState {
  count: number;
  expiresAt: number;
}

const memoryState = new Map<string, RateLimitState>();

const hashKey = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export class DistributedRateLimitService {
  constructor(private readonly redis?: Redis) {}

  async check(
    key: string,
    options: {
      limit: number;
      windowSeconds: number;
    }
  ) {
    if (!this.redis) {
      const now = Date.now();
      const storageKey = hashKey(key);
      const current = memoryState.get(storageKey);

      if (!current || current.expiresAt <= now) {
        memoryState.set(storageKey, {
          count: 1,
          expiresAt: now + options.windowSeconds * 1000
        });

        return {
          allowed: true,
          remaining: Math.max(0, options.limit - 1),
          resetAt: new Date(now + options.windowSeconds * 1000).toISOString()
        };
      }

      current.count += 1;
      memoryState.set(storageKey, current);

      return {
        allowed: current.count <= options.limit,
        remaining: Math.max(0, options.limit - current.count),
        resetAt: new Date(current.expiresAt).toISOString()
      };
    }

    const storageKey = `messenger:ratelimit:${hashKey(key)}`;
    await ensureRedisConnection(this.redis);
    const count = await this.redis.incr(storageKey);

    if (count === 1) {
      await this.redis.expire(storageKey, options.windowSeconds);
    }

    const ttlSeconds = Math.max(1, await this.redis.ttl(storageKey));

    return {
      allowed: count <= options.limit,
      remaining: Math.max(0, options.limit - count),
      resetAt: new Date(Date.now() + ttlSeconds * 1000).toISOString()
    };
  }
}
