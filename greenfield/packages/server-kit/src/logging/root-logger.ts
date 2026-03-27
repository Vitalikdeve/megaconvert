import pino from 'pino';

import { createFastifyLoggerOptions, type FastifyLoggerOptions } from './fastify-logger';

export type StructuredLogger = pino.Logger;

export function createRootLogger(options: FastifyLoggerOptions): StructuredLogger {
  return pino(createFastifyLoggerOptions(options));
}
