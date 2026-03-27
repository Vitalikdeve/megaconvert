import {
  configureHttpApp,
  createFastifyLoggerOptions,
} from '@megaconvert/server-kit';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';


import { AppModule } from '../app.module';

import { createWorkerRuntimeContext } from './runtime-context';

import type { WorkerEnvironment } from '@megaconvert/config';

export async function createWorkerApp(
  environment: WorkerEnvironment,
): Promise<NestFastifyApplication> {
  const runtimeContext = createWorkerRuntimeContext(environment);
  const adapter = new FastifyAdapter({
    logger: createFastifyLoggerOptions({
      environment: environment.NODE_ENV,
      level: environment.LOG_LEVEL,
      serviceName: runtimeContext.service.name,
    }),
  });

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.register(runtimeContext),
    adapter,
    {
      bufferLogs: true,
    },
  );

  configureHttpApp(app);

  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return app;
}
