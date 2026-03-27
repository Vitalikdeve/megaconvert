import {
  hostSchema,
  optionalUrlSchema,
  parseEnvironment,
  portSchema,
  requiredUrlSchema,
  sharedRuntimeSchema,
  type LoadEnvironmentOptions,
} from '../shared/base';

import type { z } from 'zod';

const workerEnvironmentSchema = sharedRuntimeSchema.extend({
  DATABASE_URL: requiredUrlSchema,
  HEALTHCHECK_ORIGIN: requiredUrlSchema.default('http://localhost:4020'),
  HOST: hostSchema.default('0.0.0.0'),
  PORT: portSchema.default(4020),
  REDIS_URL: optionalUrlSchema,
  S3_ENDPOINT: optionalUrlSchema,
});

export type WorkerEnvironment = z.infer<typeof workerEnvironmentSchema>;

export function loadWorkerEnvironment(options?: LoadEnvironmentOptions): WorkerEnvironment {
  return parseEnvironment(workerEnvironmentSchema, options);
}
