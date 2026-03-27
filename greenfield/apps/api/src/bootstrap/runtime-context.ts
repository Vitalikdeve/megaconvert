import { serviceDescriptorSchema, type ServiceDescriptor } from '@megaconvert/contracts';

import type { ApiEnvironment } from '@megaconvert/config';

export const API_RUNTIME_CONTEXT = Symbol('API_RUNTIME_CONTEXT');

export interface ApiRuntimeContext {
  environment: ApiEnvironment;
  service: ServiceDescriptor;
}

export function createApiRuntimeContext(
  environment: ApiEnvironment,
  startedAt = new Date().toISOString(),
): ApiRuntimeContext {
  return {
    environment,
    service: serviceDescriptorSchema.parse({
      commitSha: environment.APP_COMMIT_SHA,
      displayName: 'Megaconvert API',
      environment: environment.NODE_ENV,
      name: 'api',
      startedAt,
      version: environment.APP_VERSION,
    }),
  };
}
