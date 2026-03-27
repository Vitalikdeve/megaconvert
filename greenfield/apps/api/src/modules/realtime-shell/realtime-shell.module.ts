import { Module } from '@nestjs/common';

import { RealtimeShellService } from './application/realtime-shell.service';
import { RedisRealtimePublisher } from './infrastructure/redis-realtime.publisher';
import { REALTIME_PUBLISHER } from './realtime-shell.constants';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [RedisModule],
  exports: [REALTIME_PUBLISHER, RealtimeShellService],
  providers: [
    {
      provide: REALTIME_PUBLISHER,
      useClass: RedisRealtimePublisher,
    },
    RedisRealtimePublisher,
    RealtimeShellService,
  ],
})
export class RealtimeShellModule {}
