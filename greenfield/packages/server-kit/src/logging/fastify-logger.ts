import type { RuntimeEnvironment } from '@megaconvert/contracts';
import type { LevelWithSilent, LoggerOptions } from 'pino';

export interface FastifyLoggerOptions {
  environment: RuntimeEnvironment;
  level: LevelWithSilent;
  serviceName: string;
}

function createDevelopmentTransport() {
  return {
    options: {
      colorize: true,
      ignore: 'pid,hostname',
      singleLine: false,
      translateTime: 'SYS:standard',
    },
    target: 'pino-pretty',
  };
}

export function createFastifyLoggerOptions(options: FastifyLoggerOptions): LoggerOptions {
  const isDevelopment = options.environment === 'development';

  return {
    base: {
      service: options.serviceName,
    },
    level: options.level,
    transport: isDevelopment ? createDevelopmentTransport() : undefined,
  };
}
