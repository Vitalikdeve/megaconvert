import { describe, expect, it } from 'vitest';

import { buildReadinessReport } from './reports';

describe('readiness report builder', () => {
  it('marks the report as degraded when dependencies are not configured', () => {
    const report = buildReadinessReport(
      {
        commitSha: null,
        displayName: 'API',
        environment: 'development',
        name: 'api',
        startedAt: new Date().toISOString(),
        version: '0.1.0',
      },
      [
        {
          detail: 'Missing DATABASE_URL',
          kind: 'database',
          latencyMs: null,
          name: 'postgres',
          status: 'not-configured',
        },
      ],
    );

    expect(report.status).toBe('degraded');
  });
});
