import { createRootLogger } from './root-logger';

import type { StructuredLogger } from './root-logger';
import type { RuntimeEnvironment } from '@megaconvert/contracts';
import type { LevelWithSilent } from 'pino';


export interface WorkerLoggerOptions {
  environment: RuntimeEnvironment;
  level: LevelWithSilent;
  serviceName: string;
}

export function createWorkerLogger(options: WorkerLoggerOptions): StructuredLogger {
  return createRootLogger(options);
}
