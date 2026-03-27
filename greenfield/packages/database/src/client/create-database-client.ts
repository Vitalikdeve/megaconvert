import { drizzle } from 'drizzle-orm/node-postgres';

import {
  createPostgresPool,
  type PostgresPool,
  type PostgresPoolOptions,
} from './create-postgres-pool';
import * as schema from '../schema';

import type { NodePgDatabase } from 'drizzle-orm/node-postgres';


export type DatabaseClient = NodePgDatabase<typeof schema>;

export function createDatabaseClient(options: PostgresPoolOptions): DatabaseClient {
  const pool = createPostgresPool(options);
  return drizzle({
    client: pool,
    schema,
  });
}

export function createDatabaseClientWithPool(options: PostgresPoolOptions): {
  client: DatabaseClient;
  pool: PostgresPool;
} {
  const pool = createPostgresPool(options);

  return {
    client: drizzle({
      client: pool,
      schema,
    }),
    pool,
  };
}
