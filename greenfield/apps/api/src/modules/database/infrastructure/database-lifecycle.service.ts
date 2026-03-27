import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';

import { ApplicationLogger } from '../../logging/application-logger.service';
import { POSTGRES_POOL } from '../database.constants';

import type { PostgresPool } from '@megaconvert/database';

@Injectable()
export class DatabaseLifecycleService implements OnApplicationShutdown {
  public constructor(
    @Inject(POSTGRES_POOL) private readonly pool: PostgresPool,
    @Inject(ApplicationLogger) private readonly logger: ApplicationLogger,
  ) {}

  public async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
    this.logger.info('PostgreSQL connection pool closed.');
  }
}
