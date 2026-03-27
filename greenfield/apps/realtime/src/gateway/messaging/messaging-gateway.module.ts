import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../modules/database/database.module';
import { RealtimeEventsModule } from '../../modules/realtime-events/realtime-events.module';
import { RedisModule } from '../../modules/redis/redis.module';

import { MessagingGateway } from './messaging.gateway';
import { MessagingSocketAuthService } from './messaging-socket-auth.service';

@Module({
  imports: [DatabaseModule, RedisModule, RealtimeEventsModule],
  providers: [MessagingGateway, MessagingSocketAuthService],
})
export class MessagingGatewayModule {}
