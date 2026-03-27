import type { DatabaseClient } from '../client/create-database-client';
import type { PostgresPool } from '../client/create-postgres-pool';

export interface DatabaseSeedExecutionContext {
  client: DatabaseClient;
  pool: PostgresPool;
}

export interface DatabaseSeedDefinition {
  name: string;
  run(context: DatabaseSeedExecutionContext): Promise<void>;
}

export interface DatabaseSeedResult {
  durationMs: number;
  name: string;
}
