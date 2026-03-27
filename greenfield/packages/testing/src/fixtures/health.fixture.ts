import type { ServiceDescriptor } from '@megaconvert/contracts';

export function createServiceDescriptorFixture(overrides?: Partial<ServiceDescriptor>): ServiceDescriptor {
  return {
    commitSha: null,
    displayName: 'Fixture Service',
    environment: 'test',
    name: 'fixture-service',
    startedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    version: '0.1.0-test',
    ...overrides,
  };
}
