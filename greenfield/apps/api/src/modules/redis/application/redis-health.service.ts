import { performance } from 'node:perf_hooks';

import { Inject, Injectable } from '@nestjs/common';

import { REDIS_CLIENT } from '../redis.constants';

import type { DependencyHealth } from '@megaconvert/contracts';
import type { RedisClient } from '@megaconvert/server-kit';


@Injectable()
export class RedisHealthService {
  public constructor(
    @Inject(REDIS_CLIENT) private readonly client: RedisClient | null,
  ) {}

  public async getDependencyHealth(): Promise<DependencyHealth> {
    if (this.client === null) {
      return {
        detail: 'REDIS_URL is not configured.',
        kind: 'cache',
        latencyMs: null,
        name: 'redis',
        status: 'not-configured',
      };
    }

    const startedAt = performance.now();

    try {
      if (this.client.status === 'wait') {
        await this.client.connect();
      }

      await this.client.ping();

      return {
        detail: null,
        kind: 'cache',
        latencyMs: Math.round(performance.now() - startedAt),
        name: 'redis',
        status: 'up',
      };
    } catch (error) {
      return {
        detail: error instanceof Error ? error.message : 'Unknown Redis health check error.',
        kind: 'cache',
        latencyMs: Math.round(performance.now() - startedAt),
        name: 'redis',
        status: 'down',
      };
    }
  }
}
