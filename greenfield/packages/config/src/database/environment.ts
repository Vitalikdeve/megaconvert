import { z } from 'zod';

import {
  parseEnvironment,
  requiredUrlSchema,
  type LoadEnvironmentOptions,
} from '../shared/base';

const databaseToolEnvironmentSchema = z.object({
  DATABASE_URL: requiredUrlSchema,
});

export type DatabaseToolEnvironment = z.infer<typeof databaseToolEnvironmentSchema>;

export function loadDatabaseToolEnvironment(
  options?: LoadEnvironmentOptions,
): DatabaseToolEnvironment {
  return parseEnvironment(databaseToolEnvironmentSchema, options);
}
