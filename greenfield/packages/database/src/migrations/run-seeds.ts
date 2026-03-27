import { performance } from 'node:perf_hooks';

import type {
  DatabaseSeedDefinition,
  DatabaseSeedExecutionContext,
  DatabaseSeedResult,
} from './seed-contract';

export async function runSeeds(
  seeds: readonly DatabaseSeedDefinition[],
  context: DatabaseSeedExecutionContext,
): Promise<DatabaseSeedResult[]> {
  const results: DatabaseSeedResult[] = [];

  for (const seed of seeds) {
    const startedAt = performance.now();
    await seed.run(context);
    results.push({
      durationMs: Math.round(performance.now() - startedAt),
      name: seed.name,
    });
  }

  return results;
}
