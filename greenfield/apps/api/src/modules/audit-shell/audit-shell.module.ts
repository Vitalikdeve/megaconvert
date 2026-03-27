import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';

import { AuditShellService } from './application/audit-shell.service';
import { AUDIT_TRAIL_WRITER } from './audit-shell.constants';
import { PostgresAuditTrailWriter } from './infrastructure/postgres-audit-trail.writer';

@Module({
  exports: [AuditShellService],
  imports: [DatabaseModule],
  providers: [
    {
      provide: AUDIT_TRAIL_WRITER,
      useClass: PostgresAuditTrailWriter,
    },
    AuditShellService,
    PostgresAuditTrailWriter,
  ],
})
export class AuditShellModule {}
