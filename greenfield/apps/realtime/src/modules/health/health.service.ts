import { type LivenessReport, type ReadinessReport } from '@megaconvert/contracts';
import { probePostgres } from '@megaconvert/database';
import { buildLivenessReport, buildReadinessReport, probeRedis } from '@megaconvert/server-kit';
import { Inject, Injectable } from '@nestjs/common';

import {
  REALTIME_RUNTIME_CONTEXT,
  type RealtimeRuntimeContext,
} from '../../bootstrap/runtime-context';

@Injectable()
export class HealthService {
  public constructor(
    @Inject(REALTIME_RUNTIME_CONTEXT)
    private readonly runtimeContext: RealtimeRuntimeContext,
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
