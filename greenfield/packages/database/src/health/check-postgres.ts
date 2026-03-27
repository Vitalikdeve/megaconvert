import { performance } from 'node:perf_hooks';

import type { PostgresPool } from '../client/create-postgres-pool';
import type { DependencyHealth } from '@megaconvert/contracts';


export async function checkPostgres(pool: PostgresPool | null): Promise<DependencyHealth> {
  if (pool === null) {
    return {
      detail: 'DATABASE_URL is not configured.',
      kind: 'database',
      latencyMs: null,
      name: 'postgres',
      status: 'not-configured',
    };
  }

  const startedAt = performance.now();

  try {
    await pool.query('select 1');

    return {
      detail: null,
      kind: 'database',
      latencyMs: Math.round(performance.now() - startedAt),
      name: 'postgres',
      status: 'up',
    };
  } catch (error) {
    return {
      detail: error instanceof Error ? error.message : 'Unknown PostgreSQL health check error.',
      kind: 'database',
      latencyMs: Math.round(performance.now() - startedAt),
      name: 'postgres',
      status: 'down',
    };
  }
}
