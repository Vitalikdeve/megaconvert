import { type LivenessReport, type ReadinessReport } from '@megaconvert/contracts';
import { buildLivenessReport, buildReadinessReport } from '@megaconvert/server-kit';
import { Inject, Injectable } from '@nestjs/common';

import { ApiConfigService } from '../../config/api-config.service';
import { DatabaseHealthService } from '../../database/application/database-health.service';
import { RedisHealthService } from '../../redis/application/redis-health.service';

@Injectable()
export class HealthQueryService {
  public constructor(
    @Inject(ApiConfigService) private readonly configService: ApiConfigService,
    @Inject(DatabaseHealthService)
    private readonly databaseHealthService: DatabaseHealthService,
    @Inject(RedisHealthService)
    private readonly redisHealthService: RedisHealthService,
  ) {}

  public getLiveness(): LivenessReport {
    return buildLivenessReport(this.configService.service);
  }

  public async getReadiness(): Promise<ReadinessReport> {
    const dependencies = await Promise.all([
      this.databaseHealthService.getDependencyHealth(),
      this.redisHealthService.getDependencyHealth(),
    ]);

    return buildReadinessReport(this.configService.service, dependencies);
  }
}
