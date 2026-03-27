import { loadWebEnvironment, type WebEnvironment } from '@megaconvert/config';

export function getPublicEnvironment(): WebEnvironment {
  return loadWebEnvironment();
}
