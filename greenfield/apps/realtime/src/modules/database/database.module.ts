import { createDatabaseClientWithPool } from '@megaconvert/database';
import { Module } from '@nestjs/common';

import {
  REALTIME_RUNTIME_CONTEXT,
  type RealtimeRuntimeContext,
} from '../../bootstrap/runtime-context';

import {
  REALTIME_DATABASE_CLIENT,
  REALTIME_DATABASE_CONNECTION,
  REALTIME_POSTGRES_POOL,
} from './database.constants';
import { DatabaseLifecycleService } from './database-lifecycle.service';

@Module({
  exports: [REALTIME_DATABASE_CLIENT, REALTIME_POSTGRES_POOL],
  providers: [
    {
      inject: [REALTIME_RUNTIME_CONTEXT],
      provide: REALTIME_DATABASE_CONNECTION,
      useFactory: (runtimeContext: RealtimeRuntimeContext) =>
        createDatabaseClientWithPool({
          applicationName: runtimeContext.environment.DATABASE_APPLICATION_NAME,
          connectionString: runtimeContext.environment.DATABASE_URL,
          connectionTimeoutMs: runtimeContext.environment.DATABASE_CONNECTION_TIMEOUT_MS,
          idleTimeoutMs: runtimeContext.environment.DATABASE_IDLE_TIMEOUT_MS,
          maxConnections: runtimeContext.environment.DATABASE_POOL_MAX,
          sslMode: runtimeContext.environment.DATABASE_SSL_MODE,
          statementTimeoutMs: runtimeContext.environment.DATABASE_STATEMENT_TIMEOUT_MS,
        }),
    },
    {
      inject: [REALTIME_DATABASE_CONNECTION],
      provide: REALTIME_DATABASE_CLIENT,
      useFactory: (connection: ReturnType<typeof createDatabaseClientWithPool>) => connection.client,
    },
    {
      inject: [REALTIME_DATABASE_CONNECTION],
      provide: REALTIME_POSTGRES_POOL,
      useFactory: (connection: ReturnType<typeof createDatabaseClientWithPool>) => connection.pool,
    },
    DatabaseLifecycleService,
  ],
})
export class DatabaseModule {}
