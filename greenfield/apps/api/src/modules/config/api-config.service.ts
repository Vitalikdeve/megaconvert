import { Inject, Injectable } from '@nestjs/common';

import {
  API_RUNTIME_CONTEXT,
  type ApiRuntimeContext,
} from '../../bootstrap/runtime-context';

import type {
  ApiAuthRuntimeConfig,
  ApiDatabaseRuntimeConfig,
  ApiHttpRuntimeConfig,
  ApiRateLimitRuntimeConfig,
  ApiRedisRuntimeConfig,
  ApiRuntimeConfiguration,
  ApiSecurityRuntimeConfig,
} from './config.types';
import type { ApiEnvironment } from '@megaconvert/config';
import type { ServiceDescriptor } from '@megaconvert/contracts';

@Injectable()
export class ApiConfigService {
  public constructor(
    @Inject(API_RUNTIME_CONTEXT) private readonly runtimeContext: ApiRuntimeContext,
  ) {}

  public get auth(): ApiAuthRuntimeConfig {
    const environment = this.environment;

    return {
      accessCookieName: environment.AUTH_ACCESS_COOKIE_NAME,
      accessTokenAudience: environment.AUTH_ACCESS_TOKEN_AUDIENCE,
      accessTokenSecret: environment.AUTH_ACCESS_TOKEN_SECRET,
      accessTokenTtlSeconds: environment.AUTH_ACCESS_TOKEN_TTL_SECONDS,
      googleClientId: environment.AUTH_GOOGLE_CLIENT_ID,
      googleClientSecret: environment.AUTH_GOOGLE_CLIENT_SECRET,
      googleDiscoveryUrl: environment.AUTH_GOOGLE_DISCOVERY_URL,
      refreshCookieName: environment.AUTH_REFRESH_COOKIE_NAME,
      refreshTokenTtlDays: environment.AUTH_REFRESH_TOKEN_TTL_DAYS,
      stateCookieName: environment.AUTH_STATE_COOKIE_NAME,
      stateCookieTtlSeconds: environment.AUTH_STATE_COOKIE_TTL_SECONDS,
      stateSigningSecret: environment.AUTH_STATE_SIGNING_SECRET,
      webBaseUrl: environment.AUTH_WEB_BASE_URL,
    };
  }

  public get database(): ApiDatabaseRuntimeConfig {
    const environment = this.environment;

    return {
      applicationName: environment.DATABASE_APPLICATION_NAME,
      connectionString: environment.DATABASE_URL,
      connectionTimeoutMs: environment.DATABASE_CONNECTION_TIMEOUT_MS,
      idleTimeoutMs: environment.DATABASE_IDLE_TIMEOUT_MS,
      maxConnections: environment.DATABASE_POOL_MAX,
      runMigrationsOnBoot: environment.RUN_MIGRATIONS_ON_BOOT,
      seedHooksEnabled: environment.SEED_HOOKS_ENABLED,
      sslMode: environment.DATABASE_SSL_MODE,
      statementTimeoutMs: environment.DATABASE_STATEMENT_TIMEOUT_MS,
    };
  }

  public get environment(): ApiEnvironment {
    return this.runtimeContext.environment;
  }

  public get http(): ApiHttpRuntimeConfig {
    const environment = this.environment;

    return {
      corsOrigins: [...environment.CORS_ORIGINS],
      globalPrefix: environment.API_GLOBAL_PREFIX,
      host: environment.HOST,
      port: environment.PORT,
      publicOrigin: environment.PUBLIC_ORIGIN,
      requestIdHeader: environment.REQUEST_ID_HEADER,
      shutdownGracePeriodMs: environment.SHUTDOWN_GRACE_PERIOD_MS,
      trustProxy: environment.TRUST_PROXY,
    };
  }

  public get rateLimit(): ApiRateLimitRuntimeConfig {
    const environment = this.environment;

    return {
      allowList: [...environment.RATE_LIMIT_ALLOW_LIST],
      enabled: environment.RATE_LIMIT_ENABLED,
      max: environment.RATE_LIMIT_GLOBAL_MAX,
      windowSeconds: environment.RATE_LIMIT_GLOBAL_WINDOW_SECONDS,
    };
  }

  public get redis(): ApiRedisRuntimeConfig {
    const environment = this.environment;

    return {
      eventsChannel: environment.REALTIME_EVENTS_CHANNEL,
      keyPrefix: environment.REDIS_KEY_PREFIX,
      url: environment.REDIS_URL,
    };
  }

  public get security(): ApiSecurityRuntimeConfig {
    const environment = this.environment;

    return {
      auditPersistenceEnabled: environment.AUDIT_PERSISTENCE_ENABLED,
      securityHeadersEnabled: environment.SECURITY_HEADERS_ENABLED,
    };
  }

  public get service(): ServiceDescriptor {
    return this.runtimeContext.service;
  }

  public get snapshot(): ApiRuntimeConfiguration {
    return {
      auth: this.auth,
      database: this.database,
      environment: this.environment.NODE_ENV,
      http: this.http,
      rateLimit: this.rateLimit,
      redis: this.redis,
      security: this.security,
      service: this.service,
    };
  }
}
