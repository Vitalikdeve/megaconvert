import { z } from 'zod';

import {
  booleanStringSchema,
  commaSeparatedStringSchema,
  hostSchema,
  nonNegativeIntegerSchema,
  optionalUrlSchema,
  parseEnvironment,
  positiveIntegerSchema,
  requestIdHeaderSchema,
  portSchema,
  requiredUrlSchema,
  sharedRuntimeSchema,
  type LoadEnvironmentOptions,
} from '../shared/base';

const apiEnvironmentSchema = sharedRuntimeSchema.extend({
  API_GLOBAL_PREFIX: z
    .string()
    .trim()
    .transform((value) => (value.length === 0 ? undefined : value))
    .pipe(z.string().min(1).optional()),
  AUTH_ACCESS_TOKEN_AUDIENCE: z.string().trim().min(1).default('megaconvert-web'),
  AUTH_ACCESS_COOKIE_NAME: z.string().trim().min(1).default('mc_access'),
  AUTH_ACCESS_TOKEN_SECRET: z.string().trim().min(32),
  AUTH_ACCESS_TOKEN_TTL_SECONDS: positiveIntegerSchema.default(300),
  AUTH_GOOGLE_CLIENT_ID: z.string().trim().min(1),
  AUTH_GOOGLE_CLIENT_SECRET: z.string().trim().min(1),
  AUTH_GOOGLE_DISCOVERY_URL: requiredUrlSchema.default(
    'https://accounts.google.com/.well-known/openid-configuration',
  ),
  AUTH_REFRESH_COOKIE_NAME: z.string().trim().min(1).default('mc_refresh'),
  AUTH_REFRESH_TOKEN_TTL_DAYS: positiveIntegerSchema.default(30),
  AUTH_STATE_COOKIE_NAME: z.string().trim().min(1).default('mc_auth_state'),
  AUTH_STATE_COOKIE_TTL_SECONDS: positiveIntegerSchema.default(600),
  AUTH_STATE_SIGNING_SECRET: z.string().trim().min(32),
  AUTH_WEB_BASE_URL: requiredUrlSchema.default('http://localhost:3000'),
  AUDIT_PERSISTENCE_ENABLED: booleanStringSchema.default(false),
  CORS_ORIGINS: z.string().default('http://localhost:3000').pipe(commaSeparatedStringSchema),
  DATABASE_URL: requiredUrlSchema,
  DATABASE_APPLICATION_NAME: z.string().trim().min(1).default('megaconvert-api'),
  DATABASE_CONNECTION_TIMEOUT_MS: positiveIntegerSchema.default(5_000),
  DATABASE_IDLE_TIMEOUT_MS: positiveIntegerSchema.default(30_000),
  DATABASE_POOL_MAX: positiveIntegerSchema.default(20),
  DATABASE_SSL_MODE: z.enum(['disable', 'require']).default('disable'),
  DATABASE_STATEMENT_TIMEOUT_MS: positiveIntegerSchema.default(15_000),
  HOST: hostSchema.default('0.0.0.0'),
  PORT: portSchema.default(4000),
  PUBLIC_ORIGIN: requiredUrlSchema.default('http://localhost:4000'),
  RATE_LIMIT_ALLOW_LIST: z.string().default('').pipe(commaSeparatedStringSchema),
  RATE_LIMIT_ENABLED: booleanStringSchema.default(true),
  RATE_LIMIT_GLOBAL_MAX: positiveIntegerSchema.default(120),
  RATE_LIMIT_GLOBAL_WINDOW_SECONDS: positiveIntegerSchema.default(60),
  REALTIME_EVENTS_CHANNEL: z.string().trim().min(1).default('megaconvert:realtime:events'),
  REDIS_URL: optionalUrlSchema,
  REDIS_KEY_PREFIX: z.string().trim().min(1).default('megaconvert:api:'),
  REQUEST_ID_HEADER: requestIdHeaderSchema,
  RUN_MIGRATIONS_ON_BOOT: booleanStringSchema.default(false),
  SEED_HOOKS_ENABLED: booleanStringSchema.default(false),
  SECURITY_HEADERS_ENABLED: booleanStringSchema.default(true),
  SHUTDOWN_GRACE_PERIOD_MS: nonNegativeIntegerSchema.default(10_000),
  TRUST_PROXY: booleanStringSchema.default(false),
});

export type ApiEnvironment = z.infer<typeof apiEnvironmentSchema>;

export function loadApiEnvironment(options?: LoadEnvironmentOptions): ApiEnvironment {
  return parseEnvironment(apiEnvironmentSchema, options);
}
