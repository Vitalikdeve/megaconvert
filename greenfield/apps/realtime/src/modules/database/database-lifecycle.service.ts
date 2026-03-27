import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';

import { REALTIME_POSTGRES_POOL } from './database.constants';

import type { PostgresPool } from '@megaconvert/database';

@Injectable()
export class DatabaseLifecycleService implements OnApplicationShutdown {
  public constructor(
    @Inject(REALTIME_POSTGRES_POOL) private readonly postgresPool: PostgresPool,
  ) {}

  public async onApplicationShutdown(): Promise<void> {
    await this.postgresPool.end();
  }
}
