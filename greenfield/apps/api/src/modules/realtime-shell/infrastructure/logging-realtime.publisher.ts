import { Inject, Injectable } from '@nestjs/common';

import { ApplicationLogger } from '../../logging/application-logger.service';

import type {
  RealtimeOutboundEvent,
  RealtimePublishResult,
  RealtimePublisher,
} from '../application/realtime-publisher.port';

@Injectable()
export class LoggingRealtimePublisher implements RealtimePublisher {
  public constructor(
    @Inject(ApplicationLogger) private readonly logger: ApplicationLogger,
  ) {}

  public async publish(event: RealtimeOutboundEvent): Promise<RealtimePublishResult> {
    this.logger.info('Realtime shell received an outbound event.', {
      channel: event.channel,
      type: event.type,
    });

    return {
      accepted: false,
      reason: 'gateway-not-configured',
    };
  }
}
