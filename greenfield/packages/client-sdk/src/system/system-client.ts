import {
  createResponseEnvelopeSchema,
  livenessReportSchema,
  readinessReportSchema,
  systemOverviewSchema,
  type LivenessReport,
  type ReadinessReport,
  type SystemOverview,
} from '@megaconvert/contracts';

import { createJsonClient, type JsonClient } from '../http/json-client';

const systemOverviewEnvelopeSchema = createResponseEnvelopeSchema(systemOverviewSchema);

export interface SystemClientOptions {
  baseUrl: string;
  client?: JsonClient;
}

export interface SystemClient {
  fetchLiveness(): Promise<LivenessReport>;
  fetchReadiness(): Promise<ReadinessReport>;
  fetchSystemOverview(): Promise<SystemOverview>;
}

export function createSystemClient(options: SystemClientOptions): SystemClient {
  const client =
    options.client ??
    createJsonClient({
      baseUrl: options.baseUrl,
      timeoutMs: 8_000,
    });

  return {
    fetchLiveness: () => client.get('/health/live', { schema: livenessReportSchema }),
    fetchReadiness: () => client.get('/health/ready', { schema: readinessReportSchema }),
    async fetchSystemOverview() {
      const payload = await client.get('/', {
        query: {
          verbose: true,
        },
        schema: systemOverviewEnvelopeSchema,
      });

      return payload.data;
    },
  };
}
