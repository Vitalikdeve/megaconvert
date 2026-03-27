import { loadDatabaseToolEnvironment } from '@megaconvert/config';

import { createDatabaseClientWithPool } from '../client/create-database-client';
import { runMigrations } from '../migrations/run-migrations';

async function main(): Promise<void> {
  const environment = loadDatabaseToolEnvironment();
  const { client, pool } = createDatabaseClientWithPool({
    applicationName: 'megaconvert-database-cli',
    connectionString: environment.DATABASE_URL,
    connectionTimeoutMs: 5_000,
    idleTimeoutMs: 5_000,
    maxConnections: 1,
    sslMode: 'disable',
    statementTimeoutMs: 30_000,
  });

  try {
    await runMigrations(client);
  } finally {
    await pool.end();
  }
}

void main();
