import { loadDatabaseToolEnvironment } from '@megaconvert/config';
import { defineConfig } from 'drizzle-kit';

const environment = loadDatabaseToolEnvironment();

export default defineConfig({
  dbCredentials: {
    url: environment.DATABASE_URL,
  },
  dialect: 'postgresql',
  out: './drizzle/migrations',
  schema: './src/schema/*.ts',
  strict: true,
  verbose: true,
});
