import {
  livenessReportSchema,
  readinessReportSchema,
  type LivenessReport,
  type ReadinessReport,
} from '@megaconvert/contracts';

import { getJson } from '../http/json-client';

export async function fetchLivenessReport(baseUrl: string): Promise<LivenessReport> {
  const payload = await getJson<LivenessReport>(new URL('/health/live', baseUrl));
  return livenessReportSchema.parse(payload);
}

export async function fetchReadinessReport(baseUrl: string): Promise<ReadinessReport> {
  const payload = await getJson<ReadinessReport>(new URL('/health/ready', baseUrl));
  return readinessReportSchema.parse(payload);
}
