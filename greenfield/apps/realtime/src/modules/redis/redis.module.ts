import { createAdapter } from '@socket.io/redis-adapter';
import { createRedisClient, type RedisClient } from '@megaconvert/server-kit';
import { Module } from '@nestjs/common';

import {
  REALTIME_RUNTIME_CONTEXT,
  type RealtimeRuntimeContext,
} from '../../bootstrap/runtime-context';

import {
  REALTIME_REDIS_ADAPTER_PUBLISHER,
  REALTIME_REDIS_ADAPTER_SUBSCRIBER,
  REALTIME_REDIS_COMMAND_CLIENT,
  REALTIME_REDIS_EVENT_SUBSCRIBER,
  REALTIME_SOCKET_IO_ADAPTER_FACTORY,
} from './redis.constants';
import { RedisLifecycleService } from './redis-lifecycle.service';

@Module({
  exports: [
    REALTIME_REDIS_ADAPTER_PUBLISHER,
    REALTIME_REDIS_ADAPTER_SUBSCRIBER,
    REALTIME_REDIS_COMMAND_CLIENT,
    REALTIME_REDIS_EVENT_SUBSCRIBER,
    REALTIME_SOCKET_IO_ADAPTER_FACTORY,
  ],
  providers: [
    {
      inject: [REALTIME_RUNTIME_CONTEXT],
      provide: REALTIME_REDIS_COMMAND_CLIENT,
      useFactory: (runtimeContext: RealtimeRuntimeContext): RedisClient =>
        createRedisClient({
          connectionString: runtimeContext.environment.REDIS_URL,
          keyPrefix: runtimeContext.environment.REDIS_KEY_PREFIX,
        }),
    },
    {
      inject: [REALTIME_REDIS_COMMAND_CLIENT],
      provide: REALTIME_REDIS_ADAPTER_PUBLISHER,
      useFactory: (client: RedisClient): RedisClient => client.duplicate(),
    },
    {
      inject: [REALTIME_REDIS_COMMAND_CLIENT],
      provide: REALTIME_REDIS_ADAPTER_SUBSCRIBER,
      useFactory: (client: RedisClient): RedisClient => client.duplicate(),
    },
    {
      inject: [REALTIME_REDIS_COMMAND_CLIENT],
      provide: REALTIME_REDIS_EVENT_SUBSCRIBER,
      useFactory: (client: RedisClient): RedisClient => client.duplicate(),
    },
    {
      inject: [REALTIME_REDIS_ADAPTER_PUBLISHER, REALTIME_REDIS_ADAPTER_SUBSCRIBER],
      provide: REALTIME_SOCKET_IO_ADAPTER_FACTORY,
      useFactory: (publisher: RedisClient, subscriber: RedisClient) =>
        createAdapter(publisher, subscriber),
    },
    RedisLifecycleService,
  ],
})
export class RedisModule {}
