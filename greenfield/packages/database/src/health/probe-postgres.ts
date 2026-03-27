import { performance } from 'node:perf_hooks';

import { createPostgresPool } from '../client/create-postgres-pool';

import type { DependencyHealth } from '@megaconvert/contracts';


export async function probePostgres(connectionString: string | undefined): Promise<DependencyHealth> {
  if (!connectionString) {
    return {
      detail: 'DATABASE_URL is not configured.',
      kind: 'database',
      latencyMs: null,
      name: 'postgres',
      status: 'not-configured',
    };
  }

  const pool = createPostgresPool({
    applicationName: 'megaconvert-postgres-probe',
    connectionString,
    connectionTimeoutMs: 5_000,
    idleTimeoutMs: 5_000,
    maxConnections: 1,
    sslMode: 'disable',
    statementTimeoutMs: 5_000,
  });

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
      detail: error instanceof Error ? error.message : 'Unknown PostgreSQL connectivity error.',
      kind: 'database',
      latencyMs: Math.round(performance.now() - startedAt),
      name: 'postgres',
      status: 'down',
    };
  } finally {
    await pool.end();
  }
}
