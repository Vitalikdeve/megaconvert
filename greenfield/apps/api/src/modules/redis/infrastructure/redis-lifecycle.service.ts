import { Inject, Injectable, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';

import { ApplicationLogger } from '../../logging/application-logger.service';
import { REDIS_CLIENT } from '../redis.constants';

import type { RedisClient } from '@megaconvert/server-kit';

@Injectable()
export class RedisLifecycleService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  public constructor(
    @Inject(REDIS_CLIENT) private readonly client: RedisClient | null,
    @Inject(ApplicationLogger) private readonly logger: ApplicationLogger,
  ) {}

  public async onApplicationBootstrap(): Promise<void> {
    if (this.client === null || this.client.status !== 'wait') {
      return;
    }

    try {
      await this.client.connect();
      this.logger.info('Redis connection established.');
    } catch (error) {
      this.logger.warn(
        error instanceof Error
          ? `Redis bootstrap connection failed: ${error.message}`
          : 'Redis bootstrap connection failed.',
      );
    }
  }

  public async onApplicationShutdown(): Promise<void> {
    if (this.client === null) {
      return;
    }

    if (this.client.status === 'ready') {
      await this.client.quit();
    } else {
      this.client.disconnect();
    }

    this.logger.info('Redis connection closed.');
  }
}
