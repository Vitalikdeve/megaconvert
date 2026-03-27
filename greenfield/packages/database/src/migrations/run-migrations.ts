import path from 'node:path';

import { migrate } from 'drizzle-orm/node-postgres/migrator';

import type { DatabaseClient } from '../client/create-database-client';

export interface RunMigrationsOptions {
  migrationsFolder?: string;
}

export async function runMigrations(
  client: DatabaseClient,
  options: RunMigrationsOptions = {},
): Promise<void> {
  const migrationsFolder =
    options.migrationsFolder ?? path.resolve(process.cwd(), 'packages/database/drizzle/migrations');

  await migrate(client, {
    migrationsFolder,
  });
}
