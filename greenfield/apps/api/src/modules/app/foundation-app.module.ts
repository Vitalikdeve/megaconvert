import { Module } from '@nestjs/common';

import { AuditShellModule } from '../audit-shell/audit-shell.module';
import { RealtimeShellModule } from '../realtime-shell/realtime-shell.module';

import { SystemOverviewService } from './application/system-overview.service';
import { SystemController } from './interfaces/http/system.controller';

@Module({
  controllers: [SystemController],
  imports: [AuditShellModule, RealtimeShellModule],
  providers: [SystemOverviewService],
})
export class FoundationAppModule {}
