import { serviceDescriptorSchema, type ServiceDescriptor } from '@megaconvert/contracts';

import { getPublicEnvironment } from '../env/public-env';

const startedAt = new Date().toISOString();

export function getWebServiceDescriptor(): ServiceDescriptor {
  const environment = getPublicEnvironment();

  return serviceDescriptorSchema.parse({
    commitSha: environment.APP_COMMIT_SHA,
    displayName: 'Megaconvert Web',
    environment: environment.NODE_ENV,
    name: 'web',
    startedAt,
    version: environment.APP_VERSION,
  });
}
