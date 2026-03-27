import {
  type DynamicModule,
  Module,
  type NestModule,
} from '@nestjs/common';

import { type ApiRuntimeContext } from './bootstrap/runtime-context';
import { FoundationAppModule } from './modules/app/foundation-app.module';
import { AuditShellModule } from './modules/audit-shell/audit-shell.module';
import { AuthShellModule } from './modules/auth-shell/auth-shell.module';
import { ActorContextMiddleware } from './modules/auth-shell/infrastructure/actor-context.middleware';
import { ConfigModule } from './modules/config/config.module';
import { DatabaseModule } from './modules/database/database.module';
import { HealthModule } from './modules/health/health.module';
import { RequestContextMiddleware } from './modules/logging/infrastructure/request-context.middleware';
import { LoggingModule } from './modules/logging/logging.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { RealtimeShellModule } from './modules/realtime-shell/realtime-shell.module';
import { RedisModule } from './modules/redis/redis.module';
import { UsersModule } from './modules/users/users.module';

import type {
  MiddlewareConsumer} from '@nestjs/common';

@Module({})
export class AppModule implements NestModule {
  public static register(runtimeContext: ApiRuntimeContext): DynamicModule {
    return {
      imports: [
        ConfigModule.register(runtimeContext),
        LoggingModule,
        DatabaseModule,
        RedisModule,
        UsersModule,
        MessagingModule,
        AuthShellModule,
        RealtimeShellModule,
        AuditShellModule,
        HealthModule,
        FoundationAppModule,
      ],
      module: AppModule,
    };
  }

  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware, ActorContextMiddleware).forRoutes('*');
  }
}
