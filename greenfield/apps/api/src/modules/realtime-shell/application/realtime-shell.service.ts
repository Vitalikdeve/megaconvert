import { Inject, Injectable } from '@nestjs/common';

import { ApiConfigService } from '../../config/api-config.service';
import { REALTIME_PUBLISHER } from '../realtime-shell.constants';

import type {
  RealtimeOutboundEvent,
  RealtimePublishResult,
  RealtimePublisher,
} from './realtime-publisher.port';

@Injectable()
export class RealtimeShellService {
  public constructor(
    @Inject(ApiConfigService) private readonly configService: ApiConfigService,
    @Inject(REALTIME_PUBLISHER) private readonly realtimePublisher: RealtimePublisher,
  ) {}

  public describe() {
    return {
      mode: this.configService.redis.url ? 'redis-pubsub' : 'log-only',
      transport: this.configService.redis.url ? 'redis-channel' : 'gateway-shell',
    } as const;
  }

  public async publish(event: RealtimeOutboundEvent): Promise<RealtimePublishResult> {
    return this.realtimePublisher.publish(event);
  }
}
