import { type DynamicModule, Module } from '@nestjs/common';

import { REALTIME_RUNTIME_CONTEXT } from './bootstrap/runtime-context';
import { MessagingGatewayModule } from './gateway/messaging/messaging-gateway.module';
import { SystemGatewayModule } from './gateway/system/system-gateway.module';
import { DatabaseModule } from './modules/database/database.module';
import { HealthModule } from './modules/health/health.module';
import { RealtimeEventsModule } from './modules/realtime-events/realtime-events.module';
import { RedisModule } from './modules/redis/redis.module';
import { SystemModule } from './modules/system/system.module';

import type { RealtimeRuntimeContext} from './bootstrap/runtime-context';

@Module({})
export class AppModule {
  public static register(runtimeContext: RealtimeRuntimeContext): DynamicModule {
    return {
      exports: [REALTIME_RUNTIME_CONTEXT],
      global: true,
      imports: [
        DatabaseModule,
        RedisModule,
        RealtimeEventsModule,
        HealthModule,
        MessagingGatewayModule,
        SystemGatewayModule,
        SystemModule,
      ],
      module: AppModule,
      providers: [
        {
          provide: REALTIME_RUNTIME_CONTEXT,
          useValue: runtimeContext,
        },
      ],
    };
  }
}
