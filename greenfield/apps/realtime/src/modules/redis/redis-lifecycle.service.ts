import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';

import {
  REALTIME_REDIS_ADAPTER_PUBLISHER,
  REALTIME_REDIS_ADAPTER_SUBSCRIBER,
  REALTIME_REDIS_COMMAND_CLIENT,
  REALTIME_REDIS_EVENT_SUBSCRIBER,
} from './redis.constants';

import type { RedisClient } from '@megaconvert/server-kit';

@Injectable()
export class RedisLifecycleService implements OnApplicationShutdown {
  public constructor(
    @Inject(REALTIME_REDIS_COMMAND_CLIENT) private readonly commandClient: RedisClient,
    @Inject(REALTIME_REDIS_ADAPTER_PUBLISHER) private readonly adapterPublisher: RedisClient,
    @Inject(REALTIME_REDIS_ADAPTER_SUBSCRIBER) private readonly adapterSubscriber: RedisClient,
    @Inject(REALTIME_REDIS_EVENT_SUBSCRIBER) private readonly eventSubscriber: RedisClient,
  ) {}

  public async onApplicationShutdown(): Promise<void> {
    await Promise.allSettled([
      this.eventSubscriber.quit(),
      this.adapterSubscriber.quit(),
      this.adapterPublisher.quit(),
      this.commandClient.quit(),
    ]);
  }
}
