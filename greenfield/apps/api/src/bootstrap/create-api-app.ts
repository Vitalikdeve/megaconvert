import { randomUUID } from 'node:crypto';


import {
  configureHttpApp,
  createFastifyLoggerOptions,
  GlobalHttpExceptionFilter,
  ResponseEnvelopeInterceptor,
  resolveCorrelationId,
} from '@megaconvert/server-kit';
import { NestFactory, Reflector } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';


import { AppModule } from '../app.module';
import { DatabaseMigrationService } from '../modules/database/application/database-migration.service';
import { DatabaseSeedService } from '../modules/database/application/database-seed.service';
import { ApplicationLogger } from '../modules/logging/application-logger.service';
import { ROOT_LOGGER } from '../modules/logging/logging.constants';

import { createApiRuntimeContext } from './runtime-context';

import type { ApiEnvironment } from '@megaconvert/config';
import type { IncomingMessage } from 'node:http';

export async function createApiApp(
  environment: ApiEnvironment,
): Promise<NestFastifyApplication> {
  const runtimeContext = createApiRuntimeContext(environment);
  const adapter = new FastifyAdapter({
    genReqId: (request: IncomingMessage) =>
      resolveCorrelationId(request.headers[environment.REQUEST_ID_HEADER]) ?? randomUUID(),
    logger: createFastifyLoggerOptions({
      environment: environment.NODE_ENV,
      level: environment.LOG_LEVEL,
      serviceName: runtimeContext.service.name,
    }),
    requestIdHeader: environment.REQUEST_ID_HEADER,
    trustProxy: environment.TRUST_PROXY,
  });

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.register(runtimeContext),
    adapter,
    {
      bufferLogs: true,
    },
  );

  await configureHttpApp(app, {
    corsOrigins: environment.CORS_ORIGINS,
    enableShutdownHooks: environment.NODE_ENV !== 'test',
    globalPrefix: environment.API_GLOBAL_PREFIX,
    rateLimit: {
      allowList: environment.RATE_LIMIT_ALLOW_LIST,
      enabled: environment.RATE_LIMIT_ENABLED,
      max: environment.RATE_LIMIT_GLOBAL_MAX,
      windowSeconds: environment.RATE_LIMIT_GLOBAL_WINDOW_SECONDS,
    },
    securityHeadersEnabled: environment.SECURITY_HEADERS_ENABLED,
  });

  app.useLogger(app.get(ApplicationLogger));
  app.useGlobalFilters(new GlobalHttpExceptionFilter(app.get(ROOT_LOGGER)));
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor(app.get(Reflector)));

  await app.init();

  if (environment.RUN_MIGRATIONS_ON_BOOT) {
    await app.get(DatabaseMigrationService).runPendingMigrations();
  }

  if (environment.SEED_HOOKS_ENABLED) {
    await app.get(DatabaseSeedService).runRegisteredSeeds();
  }

  await app.getHttpAdapter().getInstance().ready();

  return app;
}
