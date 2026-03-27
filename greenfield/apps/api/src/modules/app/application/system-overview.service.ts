import { Inject, Injectable } from '@nestjs/common';

import { AuditShellService } from '../../audit-shell/application/audit-shell.service';
import { ApiConfigService } from '../../config/api-config.service';
import { RealtimeShellService } from '../../realtime-shell/application/realtime-shell.service';

import type { SystemOverviewResponse } from './system-overview.types';

@Injectable()
export class SystemOverviewService {
  public constructor(
    @Inject(ApiConfigService) private readonly apiConfigService: ApiConfigService,
    @Inject(AuditShellService) private readonly auditShellService: AuditShellService,
    @Inject(RealtimeShellService)
    private readonly realtimeShellService: RealtimeShellService,
  ) {}

  public getOverview(_verbose: boolean): SystemOverviewResponse {
    const runtimeConfiguration = this.apiConfigService.snapshot;

    return {
      modules: {
        auditShell: this.auditShellService.describe(),
        authShell: {
          defaultActorKind: 'anonymous',
          guardAvailable: true,
          resolverMode: 'anonymous-shell',
        },
        database: {
          migrationsOnBoot: runtimeConfiguration.database.runMigrationsOnBoot,
          provider: 'drizzle-postgres',
          seedHooksEnabled: runtimeConfiguration.database.seedHooksEnabled,
        },
        logging: {
          correlationHeader: runtimeConfiguration.http.requestIdHeader,
          structured: true,
        },
        realtimeShell: this.realtimeShellService.describe(),
        redis: {
          configured: runtimeConfiguration.redis.url !== undefined,
          keyPrefix: runtimeConfiguration.redis.keyPrefix,
        },
      },
      runtime: {
        corsOrigins: runtimeConfiguration.http.corsOrigins,
        environment: runtimeConfiguration.environment,
        globalPrefix: runtimeConfiguration.http.globalPrefix ?? null,
        publicOrigin: runtimeConfiguration.http.publicOrigin,
      },
      service: runtimeConfiguration.service,
    };
  }
}
