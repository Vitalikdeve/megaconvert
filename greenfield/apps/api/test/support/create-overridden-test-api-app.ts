import { randomUUID } from 'node:crypto';

import {
  configureHttpApp,
  createFastifyLoggerOptions,
  GlobalHttpExceptionFilter,
  ResponseEnvelopeInterceptor,
  resolveCorrelationId,
} from '@megaconvert/server-kit';
import { Reflector } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';

import { AppModule } from '../../src/app.module';
import { createApiRuntimeContext } from '../../src/bootstrap/runtime-context';
import { ApplicationLogger } from '../../src/modules/logging/application-logger.service';
import { ROOT_LOGGER } from '../../src/modules/logging/logging.constants';

import { buildTestEnvironment } from './build-test-environment';

import type { ApiEnvironment } from '@megaconvert/config';
import type { IncomingMessage } from 'node:http';

export interface TestProviderOverride {
  provide: unknown;
  useValue: unknown;
}

export async function createOverriddenTestApiApp(
  environmentOverrides: Partial<ApiEnvironment> = {},
  providerOverrides: readonly TestProviderOverride[] = [],
): Promise<NestFastifyApplication> {
  const environment = buildTestEnvironment(environmentOverrides);
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

  const moduleBuilder = Test.createTestingModule({
    imports: [AppModule.register(runtimeContext)],
  });

  for (const override of providerOverrides) {
    moduleBuilder.overrideProvider(override.provide).useValue(override.useValue);
  }

  const moduleRef = await moduleBuilder.compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(adapter, {
    bufferLogs: true,
  });

  await configureHttpApp(app, {
    corsOrigins: environment.CORS_ORIGINS,
    enableShutdownHooks: false,
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
  await app.getHttpAdapter().getInstance().ready();

  return app;
}
