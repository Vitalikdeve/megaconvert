import { requestContextStore } from '@megaconvert/server-kit';
import { Inject, Injectable } from '@nestjs/common';

import { ApiConfigService } from '../../config/api-config.service';
import { AUDIT_TRAIL_WRITER } from '../audit-shell.constants';

import type { AuditTrailWriter } from './audit-trail-writer.port';
import type { AuditRecordInput, AuditRecordResult } from '../domain/audit-event';

@Injectable()
export class AuditShellService {
  public constructor(
    @Inject(AUDIT_TRAIL_WRITER) private readonly auditTrailWriter: AuditTrailWriter,
    @Inject(ApiConfigService) private readonly configService: ApiConfigService,
  ) {}

  public describe() {
    return {
      persistenceEnabled: this.configService.security.auditPersistenceEnabled,
      storage: 'postgres',
    } as const;
  }

  public async record(record: AuditRecordInput): Promise<AuditRecordResult> {
    if (!this.configService.security.auditPersistenceEnabled) {
      return {
        persisted: false,
        reason: 'disabled',
      };
    }

    const requestContext = requestContextStore.get();

    await this.auditTrailWriter.write({
      ...record,
      actor: record.actor ?? {
        id: requestContext?.actorId ?? null,
        type: requestContext?.actorType ?? null,
      },
      requestId: record.requestId ?? requestContext?.correlationId ?? null,
    });

    return {
      persisted: true,
      reason: 'persisted',
    };
  }
}
