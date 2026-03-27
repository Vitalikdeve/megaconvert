
import { type LivenessReport, type ReadinessReport } from '@megaconvert/contracts';
import { probePostgres } from '@megaconvert/database';
import { buildLivenessReport, buildReadinessReport, probeRedis } from '@megaconvert/server-kit';
import { Inject, Injectable } from '@nestjs/common';

import { WORKER_RUNTIME_CONTEXT, type WorkerRuntimeContext } from '../../bootstrap/runtime-context';

@Injectable()
export class HealthService {
  public constructor(
    @Inject(WORKER_RUNTIME_CONTEXT) private readonly runtimeContext: WorkerRuntimeContext,
  ) {}

  public getLiveness(): LivenessReport {
    return buildLivenessReport(this.runtimeContext.service);
  }

  public async getReadiness(): Promise<ReadinessReport> {
    const dependencies = await Promise.all([
      probePostgres(this.runtimeContext.environment.DATABASE_URL),
      probeRedis(this.runtimeContext.environment.REDIS_URL),
    ]);

    return buildReadinessReport(this.runtimeContext.service, dependencies);
  }
}
