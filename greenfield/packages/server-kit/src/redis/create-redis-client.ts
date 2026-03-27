import Redis from 'ioredis';

export interface RedisClientOptions {
  connectionString: string;
  keyPrefix?: string;
}

export type RedisClient = Redis;

export function createRedisClient(options: RedisClientOptions): RedisClient {
  return new Redis(options.connectionString, {
    keyPrefix: options.keyPrefix,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
}
