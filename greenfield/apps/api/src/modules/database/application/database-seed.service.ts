import {
  runSeeds,
  type DatabaseClient,
  type DatabaseSeedDefinition,
  type DatabaseSeedResult,
  type PostgresPool,
} from '@megaconvert/database';
import { Inject, Injectable } from '@nestjs/common';

import { ApplicationLogger } from '../../logging/application-logger.service';
import { DATABASE_CLIENT, DATABASE_SEED_REGISTRY, POSTGRES_POOL } from '../database.constants';

@Injectable()
export class DatabaseSeedService {
  public constructor(
    @Inject(DATABASE_CLIENT) private readonly client: DatabaseClient,
    @Inject(DATABASE_SEED_REGISTRY)
    private readonly registeredSeeds: readonly DatabaseSeedDefinition[],
    @Inject(POSTGRES_POOL) private readonly pool: PostgresPool,
    @Inject(ApplicationLogger) private readonly logger: ApplicationLogger,
  ) {}

  public async runRegisteredSeeds(): Promise<DatabaseSeedResult[]> {
    const results = await runSeeds(this.registeredSeeds, {
      client: this.client,
      pool: this.pool,
    });

    this.logger.info('Database seed hooks completed.', {
      executedSeeds: results.map((result) => result.name),
    });

    return results;
  }
}
