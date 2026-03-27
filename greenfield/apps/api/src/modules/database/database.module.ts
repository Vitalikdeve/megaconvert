import {
  createDatabaseClientWithPool,
  type DatabaseSeedDefinition,
} from '@megaconvert/database';
import { Module } from '@nestjs/common';


import { ApiConfigService } from '../config/api-config.service';

import { DatabaseHealthService } from './application/database-health.service';
import { DatabaseMigrationService } from './application/database-migration.service';
import { DatabaseSeedService } from './application/database-seed.service';
import {
  DATABASE_CLIENT,
  DATABASE_CONNECTION,
  DATABASE_SEED_REGISTRY,
  POSTGRES_POOL,
} from './database.constants';
import { DatabaseLifecycleService } from './infrastructure/database-lifecycle.service';

@Module({
  exports: [
    DATABASE_CLIENT,
    DatabaseHealthService,
    DatabaseMigrationService,
    DatabaseSeedService,
    POSTGRES_POOL,
  ],
  providers: [
    {
      inject: [ApiConfigService],
      provide: DATABASE_CONNECTION,
      useFactory: (configService: ApiConfigService) =>
        createDatabaseClientWithPool({
          applicationName: configService.database.applicationName,
          connectionString: configService.database.connectionString,
          connectionTimeoutMs: configService.database.connectionTimeoutMs,
          idleTimeoutMs: configService.database.idleTimeoutMs,
          maxConnections: configService.database.maxConnections,
          sslMode: configService.database.sslMode,
          statementTimeoutMs: configService.database.statementTimeoutMs,
        }),
    },
    {
      inject: [DATABASE_CONNECTION],
      provide: DATABASE_CLIENT,
      useFactory: (connection: ReturnType<typeof createDatabaseClientWithPool>) => connection.client,
    },
    {
      inject: [DATABASE_CONNECTION],
      provide: POSTGRES_POOL,
      useFactory: (connection: ReturnType<typeof createDatabaseClientWithPool>) => connection.pool,
    },
    {
      provide: DATABASE_SEED_REGISTRY,
      useValue: [] as readonly DatabaseSeedDefinition[],
    },
    DatabaseHealthService,
    DatabaseLifecycleService,
    DatabaseMigrationService,
    DatabaseSeedService,
  ],
})
export class DatabaseModule {}
