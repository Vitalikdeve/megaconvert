import { createApiApp } from '../../src/bootstrap/create-api-app';

import { buildTestEnvironment } from './build-test-environment';

import type { ApiEnvironment } from '@megaconvert/config';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

export async function createTestApiApp(
  overrides: Partial<ApiEnvironment> = {},
): Promise<NestFastifyApplication> {
  return createApiApp(buildTestEnvironment(overrides));
}
