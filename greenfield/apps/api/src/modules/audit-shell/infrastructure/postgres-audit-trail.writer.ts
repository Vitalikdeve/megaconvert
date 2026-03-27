import { auditEventsTable, type DatabaseClient } from '@megaconvert/database';
import { Inject, Injectable } from '@nestjs/common';


import { DATABASE_CLIENT } from '../../database/database.constants';

import type { AuditTrailWriter } from '../application/audit-trail-writer.port';
import type { AuditRecordInput } from '../domain/audit-event';

@Injectable()
export class PostgresAuditTrailWriter implements AuditTrailWriter {
  public constructor(
    @Inject(DATABASE_CLIENT) private readonly client: DatabaseClient,
  ) {}

  public async write(record: AuditRecordInput): Promise<void> {
    await this.client.insert(auditEventsTable).values({
      action: record.action,
      actorId: record.actor?.id ?? null,
      actorType: record.actor?.type ?? null,
      category: record.category,
      metadata: record.metadata ?? {},
      occurredAt: record.occurredAt ? new Date(record.occurredAt) : new Date(),
      requestId: record.requestId ?? null,
      targetId: record.target?.id ?? null,
      targetType: record.target?.type ?? null,
    });
  }
}
