import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';

import type { INestApplication } from '@nestjs/common';
import type { FastifyInstance } from 'fastify';

export interface ConfigureHttpAppOptions {
  corsOrigins?: string[];
  enableShutdownHooks?: boolean;
  globalPrefix?: string;
  rateLimit?: {
    allowList: string[];
    enabled: boolean;
    max: number;
    windowSeconds: number;
  };
  securityHeadersEnabled?: boolean;
}

export async function configureHttpApp(
  app: INestApplication,
  options: ConfigureHttpAppOptions = {},
): Promise<void> {
  const fastify = app.getHttpAdapter().getInstance() as FastifyInstance;

  if (options.globalPrefix) {
    app.setGlobalPrefix(options.globalPrefix);
  }

  if (options.securityHeadersEnabled) {
    await fastify.register(helmet, {
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    });
  }

  if (options.rateLimit?.enabled) {
    await fastify.register(rateLimit, {
      addHeaders: {
        'x-ratelimit-limit': true,
        'x-ratelimit-remaining': true,
        'x-ratelimit-reset': true,
      },
      allowList: options.rateLimit.allowList,
      global: true,
      max: options.rateLimit.max,
      skipOnError: true,
      timeWindow: `${options.rateLimit.windowSeconds} seconds`,
    });
  }

  if (options.corsOrigins && options.corsOrigins.length > 0) {
    app.enableCors({
      credentials: true,
      origin: options.corsOrigins,
    });
  }

  if (options.enableShutdownHooks ?? true) {
    app.enableShutdownHooks();
  }
}
