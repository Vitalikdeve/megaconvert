import { createRedisClient, type RedisClient } from '@megaconvert/server-kit';
import { Module } from '@nestjs/common';


import { ApiConfigService } from '../config/api-config.service';

import { RedisHealthService } from './application/redis-health.service';
import { RedisLifecycleService } from './infrastructure/redis-lifecycle.service';
import { REDIS_CLIENT } from './redis.constants';

@Module({
  exports: [REDIS_CLIENT, RedisHealthService],
  providers: [
    {
      inject: [ApiConfigService],
      provide: REDIS_CLIENT,
      useFactory: (configService: ApiConfigService): RedisClient | null =>
        configService.redis.url
          ? createRedisClient({
              connectionString: configService.redis.url,
              keyPrefix: configService.redis.keyPrefix,
            })
          : null,
    },
    RedisHealthService,
    RedisLifecycleService,
  ],
})
export class RedisModule {}
