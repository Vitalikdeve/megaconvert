import { createRedisClient, ensureRedisConnection } from "../../../core/redis";

const userSocketsKey = (userId: string) => `messenger:presence:user:${userId}:sockets`;
const socketOwnerKey = (socketId: string) => `messenger:presence:socket:${socketId}`;

export interface UserPresenceService {
  markConnected(userId: string, socketId: string): Promise<void>;
  markDisconnected(socketId: string): Promise<void>;
  isUserOnline(userId: string): Promise<boolean>;
}

export class InMemoryUserPresenceService implements UserPresenceService {
  private readonly usersBySocket = new Map<string, string>();

  private readonly socketsByUser = new Map<string, Set<string>>();

  async markConnected(userId: string, socketId: string) {
    this.usersBySocket.set(socketId, userId);
    const sockets = this.socketsByUser.get(userId) ?? new Set<string>();
    sockets.add(socketId);
    this.socketsByUser.set(userId, sockets);
  }

  async markDisconnected(socketId: string) {
    const userId = this.usersBySocket.get(socketId);

    if (!userId) {
      return;
    }

    this.usersBySocket.delete(socketId);
    const sockets = this.socketsByUser.get(userId);

    if (!sockets) {
      return;
    }

    sockets.delete(socketId);

    if (sockets.size === 0) {
      this.socketsByUser.delete(userId);
    }
  }

  async isUserOnline(userId: string) {
    return (this.socketsByUser.get(userId)?.size ?? 0) > 0;
  }
}

export class RedisUserPresenceService implements UserPresenceService {
  private readonly redis;

  constructor(private readonly redisUrl: string) {
    this.redis = createRedisClient(redisUrl, "messenger-user-presence");
  }

  async markConnected(userId: string, socketId: string) {
    await ensureRedisConnection(this.redis);
    await this.redis
      .multi()
      .set(socketOwnerKey(socketId), userId)
      .sadd(userSocketsKey(userId), socketId)
      .exec();
  }

  async markDisconnected(socketId: string) {
    await ensureRedisConnection(this.redis);
    const userId = await this.redis.get(socketOwnerKey(socketId));

    if (!userId) {
      return;
    }

    await this.redis
      .multi()
      .del(socketOwnerKey(socketId))
      .srem(userSocketsKey(userId), socketId)
      .exec();
  }

  async isUserOnline(userId: string) {
    await ensureRedisConnection(this.redis);
    return (await this.redis.scard(userSocketsKey(userId))) > 0;
  }

  async close() {
    if (this.redis.status !== "end") {
      await this.redis.quit();
    }
  }
}
