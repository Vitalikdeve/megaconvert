import { performance } from 'node:perf_hooks';

import Redis from 'ioredis';

import type { DependencyHealth } from '@megaconvert/contracts';

export async function probeRedis(connectionString: string | undefined): Promise<DependencyHealth> {
  if (!connectionString) {
    return {
      detail: 'REDIS_URL is not configured.',
      kind: 'cache',
      latencyMs: null,
      name: 'redis',
      status: 'not-configured',
    };
  }

  const startedAt = performance.now();
  const redis = new Redis(connectionString, {
    lazyConnect: true,
    maxRetriesPerRequest: 0,
  });

  try {
    await redis.connect();
    await redis.ping();

    return {
      detail: null,
      kind: 'cache',
      latencyMs: Math.round(performance.now() - startedAt),
      name: 'redis',
      status: 'up',
    };
  } catch (error) {
    return {
      detail: error instanceof Error ? error.message : 'Unknown Redis connectivity error.',
      kind: 'cache',
      latencyMs: Math.round(performance.now() - startedAt),
      name: 'redis',
      status: 'down',
    };
  } finally {
    redis.disconnect();
  }
}
