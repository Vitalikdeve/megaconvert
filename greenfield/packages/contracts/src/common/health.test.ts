import { describe, expect, it } from 'vitest';

import { readinessReportSchema } from './health';

describe('health contracts', () => {
  it('accepts a valid readiness payload', () => {
    const parsed = readinessReportSchema.parse({
      dependencies: [
        {
          detail: null,
          kind: 'database',
          latencyMs: 12,
          name: 'postgres',
          status: 'up',
        },
      ],
      service: {
        commitSha: null,
        displayName: 'API',
        environment: 'development',
        name: 'api',
        startedAt: new Date().toISOString(),
        version: '0.1.0',
      },
      status: 'ok',
      timestamp: new Date().toISOString(),
    });

    expect(parsed.status).toBe('ok');
  });
});
