import { serviceDescriptorSchema, type ServiceDescriptor } from '@megaconvert/contracts';

import type { RealtimeEnvironment } from '@megaconvert/config';

export const REALTIME_RUNTIME_CONTEXT = Symbol('REALTIME_RUNTIME_CONTEXT');

export interface RealtimeRuntimeContext {
  environment: RealtimeEnvironment;
  service: ServiceDescriptor;
}

export function createRealtimeRuntimeContext(
  environment: RealtimeEnvironment,
  startedAt = new Date().toISOString(),
): RealtimeRuntimeContext {
  return {
    environment,
    service: serviceDescriptorSchema.parse({
      commitSha: environment.APP_COMMIT_SHA,
      displayName: 'Megaconvert Realtime Gateway',
      environment: environment.NODE_ENV,
      name: 'realtime',
      startedAt,
      version: environment.APP_VERSION,
    }),
  };
}
