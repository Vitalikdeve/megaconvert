import { Module } from '@nestjs/common';

import { SocketServerRegistryService } from '../../gateway/messaging/socket-server-registry.service';
import { RedisModule } from '../redis/redis.module';

import { RedisRealtimeEventsService } from './redis-realtime-events.service';

@Module({
  exports: [RedisRealtimeEventsService, SocketServerRegistryService],
  imports: [RedisModule],
  providers: [SocketServerRegistryService, RedisRealtimeEventsService],
})
export class RealtimeEventsModule {}
