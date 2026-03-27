import { serviceDescriptorSchema, type ServiceDescriptor } from '@megaconvert/contracts';

import type { WorkerEnvironment } from '@megaconvert/config';

export const WORKER_RUNTIME_CONTEXT = Symbol('WORKER_RUNTIME_CONTEXT');

export interface WorkerRuntimeContext {
  environment: WorkerEnvironment;
  service: ServiceDescriptor;
}

export function createWorkerRuntimeContext(
  environment: WorkerEnvironment,
  startedAt = new Date().toISOString(),
): WorkerRuntimeContext {
  return {
    environment,
    service: serviceDescriptorSchema.parse({
      commitSha: environment.APP_COMMIT_SHA,
      displayName: 'Megaconvert Worker',
      environment: environment.NODE_ENV,
      name: 'worker',
      startedAt,
      version: environment.APP_VERSION,
    }),
  };
}
