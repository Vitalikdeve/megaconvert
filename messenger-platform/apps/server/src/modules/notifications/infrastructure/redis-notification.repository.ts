import type { WebPushSubscription } from "@messenger/shared";

import { createRedisClient, ensureRedisConnection } from "../../../core/redis";

const subscriptionKey = (endpointHash: string) =>
  `messenger:notification:subscription:${endpointHash}`;
const userSubscriptionsKey = (userId: string) =>
  `messenger:notification:user:${userId}:subscriptions`;

const endpointHash = (endpoint: string) =>
  Buffer.from(endpoint).toString("base64url");

export interface NotificationSubscriptionRepository {
  register(userId: string, subscription: WebPushSubscription): Promise<void>;
  remove(userId: string, endpoint: string): Promise<void>;
  listByUser(userId: string): Promise<WebPushSubscription[]>;
}

export class InMemoryNotificationSubscriptionRepository
  implements NotificationSubscriptionRepository
{
  private readonly subscriptionsByUser = new Map<string, WebPushSubscription[]>();

  async register(userId: string, subscription: WebPushSubscription) {
    const current = this.subscriptionsByUser.get(userId) ?? [];
    const next = current.filter((item) => item.endpoint !== subscription.endpoint);
    next.push(subscription);
    this.subscriptionsByUser.set(userId, next);
  }

  async remove(userId: string, endpoint: string) {
    const current = this.subscriptionsByUser.get(userId) ?? [];
    this.subscriptionsByUser.set(
      userId,
      current.filter((item) => item.endpoint !== endpoint)
    );
  }

  async listByUser(userId: string) {
    return [...(this.subscriptionsByUser.get(userId) ?? [])];
  }
}

export class RedisNotificationSubscriptionRepository
  implements NotificationSubscriptionRepository
{
  private readonly redis;

  constructor(private readonly redisUrl: string) {
    this.redis = createRedisClient(
      redisUrl,
      "messenger-notification-repository"
    );
  }

  async register(userId: string, subscription: WebPushSubscription) {
    await ensureRedisConnection(this.redis);
    const hash = endpointHash(subscription.endpoint);

    await this.redis
      .multi()
      .set(subscriptionKey(hash), JSON.stringify(subscription))
      .sadd(userSubscriptionsKey(userId), hash)
      .exec();
  }

  async remove(userId: string, endpoint: string) {
    await ensureRedisConnection(this.redis);
    const hash = endpointHash(endpoint);

    await this.redis
      .multi()
      .del(subscriptionKey(hash))
      .srem(userSubscriptionsKey(userId), hash)
      .exec();
  }

  async listByUser(userId: string) {
    await ensureRedisConnection(this.redis);
    const hashes = await this.redis.smembers(userSubscriptionsKey(userId));

    if (hashes.length === 0) {
      return [];
    }

    const payloads = await this.redis.mget(
      hashes.map((hash) => subscriptionKey(hash))
    );

    return payloads
      .filter((payload): payload is string => Boolean(payload))
      .map((payload) => JSON.parse(payload) as WebPushSubscription);
  }

  async close() {
    if (this.redis.status !== "end") {
      await this.redis.quit();
    }
  }
}
