import { checkPostgres, type PostgresPool } from '@megaconvert/database';
import { Inject, Injectable } from '@nestjs/common';

import { POSTGRES_POOL } from '../database.constants';

import type { DependencyHealth } from '@megaconvert/contracts';


@Injectable()
export class DatabaseHealthService {
  public constructor(
    @Inject(POSTGRES_POOL) private readonly pool: PostgresPool,
  ) {}

  public async getDependencyHealth(): Promise<DependencyHealth> {
    return checkPostgres(this.pool);
  }
}
