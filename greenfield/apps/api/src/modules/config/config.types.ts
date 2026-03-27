import type { ApiEnvironment } from '@megaconvert/config';
import type { ServiceDescriptor } from '@megaconvert/contracts';

export interface ApiAuthRuntimeConfig {
  accessCookieName: string;
  accessTokenAudience: string;
  accessTokenSecret: string;
  accessTokenTtlSeconds: number;
  googleClientId: string;
  googleClientSecret: string;
  googleDiscoveryUrl: string;
  refreshCookieName: string;
  refreshTokenTtlDays: number;
  stateCookieName: string;
  stateCookieTtlSeconds: number;
  stateSigningSecret: string;
  webBaseUrl: string;
}

export interface ApiHttpRuntimeConfig {
  corsOrigins: readonly string[];
  globalPrefix: string | undefined;
  host: string;
  port: number;
  publicOrigin: string;
  requestIdHeader: string;
  shutdownGracePeriodMs: number;
  trustProxy: boolean;
}

export interface ApiDatabaseRuntimeConfig {
  applicationName: string;
  connectionString: string;
  connectionTimeoutMs: number;
  idleTimeoutMs: number;
  maxConnections: number;
  runMigrationsOnBoot: boolean;
  seedHooksEnabled: boolean;
  sslMode: ApiEnvironment['DATABASE_SSL_MODE'];
  statementTimeoutMs: number;
}

export interface ApiRedisRuntimeConfig {
  eventsChannel: string;
  keyPrefix: string;
  url: string | undefined;
}

export interface ApiRateLimitRuntimeConfig {
  allowList: readonly string[];
  enabled: boolean;
  max: number;
  windowSeconds: number;
}

export interface ApiSecurityRuntimeConfig {
  auditPersistenceEnabled: boolean;
  securityHeadersEnabled: boolean;
}

export interface ApiRuntimeConfiguration {
  auth: ApiAuthRuntimeConfig;
  database: ApiDatabaseRuntimeConfig;
  environment: ApiEnvironment['NODE_ENV'];
  http: ApiHttpRuntimeConfig;
  rateLimit: ApiRateLimitRuntimeConfig;
  redis: ApiRedisRuntimeConfig;
  security: ApiSecurityRuntimeConfig;
  service: ServiceDescriptor;
}
