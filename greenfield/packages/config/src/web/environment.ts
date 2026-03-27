import {
  parseEnvironment,
  requiredUrlSchema,
  sharedRuntimeSchema,
  type LoadEnvironmentOptions,
} from '../shared/base';

import type { z } from 'zod';

const webEnvironmentSchema = sharedRuntimeSchema.extend({
  NEXT_PUBLIC_API_BASE_URL: requiredUrlSchema.default('http://localhost:4000'),
  NEXT_PUBLIC_APP_ORIGIN: requiredUrlSchema.default('http://localhost:3000'),
  NEXT_PUBLIC_REALTIME_BASE_URL: requiredUrlSchema.default('http://localhost:4010'),
});

export type WebEnvironment = z.infer<typeof webEnvironmentSchema>;

export function loadWebEnvironment(options?: LoadEnvironmentOptions): WebEnvironment {
  return parseEnvironment(webEnvironmentSchema, options);
}
