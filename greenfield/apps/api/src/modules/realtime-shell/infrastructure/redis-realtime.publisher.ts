import { Inject, Injectable } from '@nestjs/common';

import { ApiConfigService } from '../../config/api-config.service';
import { ApplicationLogger } from '../../logging/application-logger.service';
import { REDIS_CLIENT } from '../../redis/redis.constants';

import type {
  RealtimeOutboundEvent,
  RealtimePublishResult,
  RealtimePublisher,
} from '../application/realtime-publisher.port';
import type { RedisClient } from '@megaconvert/server-kit';

@Injectable()
export class RedisRealtimePublisher implements RealtimePublisher {
  public constructor(
    @Inject(ApiConfigService) private readonly configService: ApiConfigService,
    @Inject(ApplicationLogger) private readonly logger: ApplicationLogger,
    @Inject(REDIS_CLIENT) private readonly redisClient: RedisClient | null,
  ) {}

  public async publish(event: RealtimeOutboundEvent): Promise<RealtimePublishResult> {
    if (!this.redisClient) {
      this.logger.warn('Realtime publish skipped because Redis is not configured.');
      return {
        accepted: false,
        reason: 'gateway-not-configured',
      };
    }

    const envelope = JSON.stringify({
      channel: event.channel,
      payload: event.payload,
      type: event.type,
    });

    await this.redisClient.publish(this.configService.redis.eventsChannel, envelope);

    this.logger.debug('Published realtime event to Redis.', 'RedisRealtimePublisher');

    return {
      accepted: true,
      reason: 'published',
    };
  }
}
