import {
  configureHttpApp,
  createFastifyLoggerOptions,
} from '@megaconvert/server-kit';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

import { AppModule } from '../app.module';
import { REALTIME_SOCKET_IO_ADAPTER_FACTORY } from '../modules/redis/redis.constants';

import { RealtimeSocketIoAdapter } from './realtime-socket-io.adapter';
import { createRealtimeRuntimeContext } from './runtime-context';

import type { RealtimeEnvironment } from '@megaconvert/config';

export async function createRealtimeApp(
  environment: RealtimeEnvironment,
): Promise<NestFastifyApplication> {
  const runtimeContext = createRealtimeRuntimeContext(environment);
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

  app.useWebSocketAdapter(
    new RealtimeSocketIoAdapter(
      app,
      environment.CORS_ORIGINS,
      app.get(REALTIME_SOCKET_IO_ADAPTER_FACTORY),
    ),
  );

  await configureHttpApp(app);

  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return app;
}
