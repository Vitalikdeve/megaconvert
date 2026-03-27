import {
  messagingTransportEnvelopeSchema,
  type MessagingTransportEnvelope,
} from '@megaconvert/contracts';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';

import {
  REALTIME_RUNTIME_CONTEXT,
  type RealtimeRuntimeContext,
} from '../../bootstrap/runtime-context';
import { REALTIME_REDIS_EVENT_SUBSCRIBER } from '../redis/redis.constants';
import { SocketServerRegistryService } from '../../gateway/messaging/socket-server-registry.service';

import type { RedisClient } from '@megaconvert/server-kit';

@Injectable()
export class RedisRealtimeEventsService implements OnModuleInit {
  private readonly logger = new Logger(RedisRealtimeEventsService.name);

  public constructor(
    @Inject(REALTIME_RUNTIME_CONTEXT)
    private readonly runtimeContext: RealtimeRuntimeContext,
    @Inject(REALTIME_REDIS_EVENT_SUBSCRIBER)
    private readonly eventSubscriber: RedisClient,
    @Inject(SocketServerRegistryService)
    private readonly socketServerRegistry: SocketServerRegistryService,
  ) {}

  public async onModuleInit(): Promise<void> {
    await this.eventSubscriber.subscribe(this.runtimeContext.environment.REALTIME_EVENTS_CHANNEL);
    this.eventSubscriber.on('message', (_channel, payload) => {
      void this.handleMessage(payload);
    });
  }

  private async handleMessage(payload: string): Promise<void> {
    const server = this.socketServerRegistry.getServer();

    if (!server) {
      return;
    }

    try {
      const parsed = JSON.parse(payload) as {
        channel?: unknown;
        payload?: unknown;
        type?: unknown;
      };

      if (parsed.channel !== 'messaging.transport') {
        return;
      }

      const envelope = messagingTransportEnvelopeSchema.parse(parsed.payload);
      this.emitEnvelope(envelope);
    } catch (error) {
      this.logger.warn(
        error instanceof Error ? error.message : 'Failed to parse realtime envelope.',
      );
    }
  }

  private emitEnvelope(envelope: MessagingTransportEnvelope): void {
    const server = this.socketServerRegistry.getServer();

    if (!server) {
      return;
    }

    for (const room of envelope.targetRooms) {
      let emitter = server.to(room);

      if (envelope.excludeSocketId) {
        emitter = emitter.except(envelope.excludeSocketId);
      }

      emitter.emit(envelope.event.type, envelope.event);
    }
  }
}
