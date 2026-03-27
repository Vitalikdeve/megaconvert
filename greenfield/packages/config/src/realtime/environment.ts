import {
  commaSeparatedStringSchema,
  hostSchema,
  parseEnvironment,
  portSchema,
  positiveIntegerSchema,
  requiredUrlSchema,
  requestIdHeaderSchema,
  sharedRuntimeSchema,
  type LoadEnvironmentOptions,
} from '../shared/base';

import { z } from 'zod';

const realtimeEnvironmentSchema = sharedRuntimeSchema.extend({
  AUTH_ACCESS_TOKEN_AUDIENCE: z.string().trim().min(1).default('megaconvert-web'),
  AUTH_ACCESS_COOKIE_NAME: z.string().trim().min(1).default('mc_access'),
  AUTH_ACCESS_TOKEN_SECRET: z.string().trim().min(32),
  CORS_ORIGINS: z.string().default('http://localhost:3000').pipe(commaSeparatedStringSchema),
  DATABASE_APPLICATION_NAME: z.string().trim().min(1).default('megaconvert-realtime'),
  DATABASE_CONNECTION_TIMEOUT_MS: positiveIntegerSchema.default(5_000),
  DATABASE_IDLE_TIMEOUT_MS: positiveIntegerSchema.default(30_000),
  DATABASE_POOL_MAX: positiveIntegerSchema.default(8),
  DATABASE_SSL_MODE: z.enum(['disable', 'require']).default('disable'),
  DATABASE_STATEMENT_TIMEOUT_MS: positiveIntegerSchema.default(15_000),
  DATABASE_URL: requiredUrlSchema,
  HOST: hostSchema.default('0.0.0.0'),
  PORT: portSchema.default(4010),
  PUBLIC_ORIGIN: requiredUrlSchema.default('http://localhost:4010'),
  REALTIME_EVENTS_CHANNEL: z.string().trim().min(1).default('megaconvert:realtime:events'),
  REDIS_URL: requiredUrlSchema,
  REDIS_KEY_PREFIX: z.string().trim().min(1).default('megaconvert:realtime:'),
  REQUEST_ID_HEADER: requestIdHeaderSchema,
  TYPING_TTL_SECONDS: positiveIntegerSchema.default(8),
  USER_PRESENCE_TTL_SECONDS: positiveIntegerSchema.default(70),
});

export type RealtimeEnvironment = z.infer<typeof realtimeEnvironmentSchema>;

export function loadRealtimeEnvironment(options?: LoadEnvironmentOptions): RealtimeEnvironment {
  return parseEnvironment(realtimeEnvironmentSchema, options);
}
