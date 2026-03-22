import Redis from "ioredis";

export const createRedisClient = (redisUrl: string, connectionName: string) =>
  new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    connectionName
  });

export const ensureRedisConnection = async (redis: Redis) => {
  if (redis.status === "ready" || redis.status === "connect") {
    return;
  }

  await redis.connect().catch((error: unknown) => {
    if (
      error instanceof Error &&
      error.message.includes("Redis is already connecting/connected")
    ) {
      return;
    }

    throw error;
  });
};
