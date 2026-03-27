import { describe, expect, it } from 'vitest';

import { probePostgres } from './probe-postgres';

describe('probePostgres', () => {
  it('reports not-configured when DATABASE_URL is missing', async () => {
    await expect(probePostgres(undefined)).resolves.toMatchObject({
      name: 'postgres',
      status: 'not-configured',
    });
  });
});
