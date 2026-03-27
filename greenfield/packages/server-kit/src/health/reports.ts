import {
  livenessReportSchema,
  readinessReportSchema,
  type DependencyHealth,
  type LivenessReport,
  type ReadinessReport,
  type ServiceDescriptor,
} from '@megaconvert/contracts';
import { utcNowIso } from '@megaconvert/shared-kernel';

export function buildLivenessReport(service: ServiceDescriptor): LivenessReport {
  return livenessReportSchema.parse({
    service,
    status: 'ok',
    timestamp: utcNowIso(),
  });
}

export function buildReadinessReport(
  service: ServiceDescriptor,
  dependencies: DependencyHealth[],
): ReadinessReport {
  const status = dependencies.some((dependency) => dependency.status === 'down')
    ? 'down'
    : dependencies.some((dependency) => dependency.status === 'not-configured')
      ? 'degraded'
      : 'ok';

  return readinessReportSchema.parse({
    dependencies,
    service,
    status,
    timestamp: utcNowIso(),
  });
}
